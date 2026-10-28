import type { InstancesOutput } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const INTER = {
  family: "Inter",
  style: "Regular",
};

const text = (id: string, name: string, characters: string, fields: Record<string, unknown> = {}) => ({
  id,
  type: "TEXT",
  name,
  characters,
  fontName: INTER,
  ...fields,
});

const image = (hash: string) => [
  {
    type: "IMAGE",
    visible: true,
    imageHash: hash,
    scaleMode: "FILL",
  },
];

const RED = [
  {
    type: "SOLID",
    visible: true,
    color: {
      r: 1,
      g: 0,
      b: 0,
    },
  },
];

/** A card component, a frame detached from it with its own copy, button sets, and an instance with overrides. */
function document(): FakeNode {
  return tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "5:1",
        name: "Card",
        type: "COMPONENT",
        width: 300,
        height: 200,
        componentPropertyDefinitions: {
          "Title#1:1": {
            type: "TEXT",
            defaultValue: "Title",
          },
        },
        children: [
          text("5:2", "Title", "Title", { componentPropertyReferences: { characters: "Title#1:1" } }),
          text("5:3", "Body", "Body text"),
          {
            id: "5:4",
            name: "Photo",
            type: "RECTANGLE",
            fills: image("a".repeat(40)),
          },
          {
            id: "5:5",
            name: "Badge",
            visible: true,
          },
        ],
      },
      {
        id: "1:0",
        name: "Row",
        layoutMode: "HORIZONTAL",
        children: [
          {
            id: "1:1",
            name: "Card",
            width: 320,
            height: 200,
            detachedInfo: {
              type: "local",
              componentId: "5:1",
            },
            children: [
              text("1:2", "Title", "Pro plan"),
              text("1:3", "Body", "For teams"),
              {
                id: "1:4",
                name: "Photo",
                type: "RECTANGLE",
                fills: image("b".repeat(40)),
              },
              {
                id: "1:5",
                name: "Badge",
                visible: false,
              },
              text("1:6", "Extra", "Only here"),
            ],
          },
          {
            id: "1:7",
            name: "Old",
            detachedInfo: {
              type: "local",
              componentId: "9:9",
            },
          },
        ],
      },
    ],
  });
}

let page: FakeNode;
let writes: ReturnType<typeof installFigma>["writes"];

const byId = (id: string): FakeNode | undefined => {
  const find = (at: FakeNode): FakeNode | undefined =>
    at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

  return find(page);
};

beforeEach(() => {
  page = document();
  ({ writes } = installFigma(page, { fonts: [INTER] }, { removedThrows: true }));
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const run = (input: Record<string, unknown>) =>
  plugin.run("instances", {
    roots: ["1:0"],
    ...input,
  }) as Promise<InstancesOutput>;

describe("instances: detached frames put back", () => {
  it("puts an instance of the component where the frame was, with the frame's texts, images and hidden layers", async () => {
    const output = await run({ reattach: true });
    const [card] = output.reattached;
    const row = byId("1:0");
    const instance = row?.children?.[0];

    expect(card).toMatchObject({
      frame: "1:1",
      name: "Card",
      component: "Card",
      kept: ["text Title", "text Body", "image Photo", "hidden Badge"],
      lost: ["Extra"],
    });
    expect(instance?.type).toBe("INSTANCE");
    expect(instance?.id).toBe(card?.instance);
    expect(byId("1:1")).toBeUndefined();
    expect(writes.calls.filter(({ method }) => method === "setProperties")).toMatchObject([
      {
        node: instance?.id,
        args: [{ "Title#1:1": "Pro plan" }],
      },
    ]);

    const layer = (name: string) => instance?.children?.find((child) => child.name === name);

    expect(layer("Body")?.characters).toBe("For teams");
    expect(layer("Photo")?.fills).toEqual(image("b".repeat(40)));
    expect(layer("Badge")?.visible).toBe(false);
    expect(instance?.width).toBe(320);
    expect(writes.undo).toBe(1);
  });

  it("names a frame whose component is gone, and puts the others back", async () => {
    const output = await run({ reattach: true });

    expect(output.errors).toEqual([
      {
        id: "1:7",
        message: "Old was detached from a component that is no longer in this file.",
      },
    ]);
  });

  it("leaves the frame as it was when its content cannot be put in (a missing font), with no instance beside it", async () => {
    page = document();
    (page.children?.[0]?.children?.[1] as FakeNode).fontName = {
      family: "Gone Sans",
      style: "Regular",
    };
    ({ writes } = installFigma(page, {
      fonts: [INTER],
      unloadable: [
        {
          family: "Gone Sans",
          style: "Regular",
        },
      ],
    }));

    const output = await run({ reattach: true });

    expect(output.reattached).toEqual([]);
    expect(output.errors.map(({ id }) => id)).toEqual(["1:1", "1:7"]);
    expect(byId("1:0")?.children?.map(({ id }) => id)).toEqual(["1:1", "1:7"]);
  });

  it("finds what it would do in a dry run, which writes nothing and works with Allow edits off", async () => {
    plugin.services.edits.allow(false);

    const output = await run({
      reattach: true,
      dryRun: true,
    });

    expect(output.reattached).toMatchObject([
      {
        frame: "1:1",
        instance: null,
        kept: ["text Title", "text Body", "image Photo", "hidden Badge"],
        lost: ["Extra"],
      },
    ]);
    expect(writes.calls).toEqual([]);
  });
});

describe("instances: swapped and reset", () => {
  /** Two button sets with the same variants, and an instance of the first in a row, overriding a fill and a text. */
  function buttons(): FakeNode {
    const set = (id: string, name: string) => ({
      id,
      name,
      type: "COMPONENT_SET",
      componentPropertyDefinitions: {
        State: {
          type: "VARIANT",
          defaultValue: "Default",
          variantOptions: ["Default", "Hover"],
        },
      },
      children: ["Default", "Hover"].map((state, index) => ({
        id: `${id}${index + 1}`,
        name: `State=${state}`,
        type: "COMPONENT",
        children: [
          {
            id: `${id}${index + 1}0`,
            name: "Background",
            type: "RECTANGLE",
            fills: [],
          },
          text(`${id}${index + 1}1`, "Label", "Button"),
        ],
      })),
    });

    return tree({
      id: "0:1",
      type: "PAGE",
      children: [
        set("6:", "Button"),
        set("7:", "Button v2"),
        {
          id: "1:0",
          name: "Row",
        },
      ],
    });
  }

  beforeEach(async () => {
    page = buttons();

    const installed = installFigma(page, { fonts: [INTER] });

    // The test writes the override itself, as a designer would, with the font loaded.
    await (
      globalThis as unknown as { figma: { loadFontAsync: (font: FontName) => Promise<void> } }
    ).figma.loadFontAsync(INTER);

    const hover = byId("6:2") as FakeNode & { createInstance: () => FakeNode };
    const instance = hover.createInstance();
    const row = byId("1:0") as FakeNode & { appendChild: (child: FakeNode) => void };

    row.appendChild(instance);
    instance.overrides = [
      {
        id: instance.children?.[0]?.id,
        overriddenFields: ["fills"],
      },
      {
        id: instance.children?.[1]?.id,
        overriddenFields: ["characters"],
      },
    ];
    (instance.children?.[0] as FakeNode).fills = RED;
    (instance.children?.[1] as FakeNode).characters = "Buy now";
    writes = installed.writes;
    writes.calls.length = 0;
  });

  it("swaps instances of one set for the other's variant with the same values", async () => {
    const output = await run({
      swap: [
        {
          from: "Button",
          to: "Button v2",
        },
      ],
    });

    expect(output.swapped).toMatchObject([
      {
        from: "Button",
        to: "Button v2",
      },
    ]);
    expect(writes.calls.filter(({ method }) => method === "swapComponent")).toMatchObject([{ args: ["7:2"] }]);
  });

  it("takes an instance's look overrides off and keeps its texts, since Figma keeps a field reset by value overridden", async () => {
    const output = await run({ reset: "look" });
    const instance = byId("1:0")?.children?.[0];

    expect(output.reset).toMatchObject([{ fields: ["fills"] }]);
    expect(instance?.children?.[0]?.fills).toEqual([]);
    expect(instance?.children?.[1]?.characters).toBe("Buy now");
    expect(writes.calls.filter(({ method }) => method === "removeOverrides")).toHaveLength(1);
  });

  it("takes every override off with reset all", async () => {
    await run({ reset: "all" });

    expect(writes.calls.filter(({ method }) => method === "removeOverrides")).toHaveLength(1);
  });
});
