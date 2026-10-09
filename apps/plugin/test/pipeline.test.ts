import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/mcp/tools/apply.ts";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";

/** design_apply end to end: the server's applyDesign over the plugin on the fake Figma. */
function pipeline() {
  const bridge = pluginBridge();

  return (xml: string, options: { parent?: string; dryRun?: boolean } = {}) =>
    applyDesign(bridge, {
      xml,
      dryRun: options.dryRun ?? false,
      ...(options.parent === undefined ? {} : { parent: options.parent }),
    });
}

/** A text as a snapshot reads it: one run in one font, black, left and top aligned, sizing itself. */
const text = (id: string, characters: string, family = "Inter", style = "Regular") => ({
  id,
  type: "TEXT",
  name: characters,
  characters,
  textAutoResize: "WIDTH_AND_HEIGHT",
  fontName: {
    family,
    style,
  },
  fontSize: 16,
  fontWeight: style === "Regular" ? 400 : 500,
  fillStyleId: "",
  textStyleId: "",
  hyperlink: null,
  textAlignHorizontal: "LEFT",
  textAlignVertical: "TOP",
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      blendMode: "NORMAL",
      color: {
        r: 0,
        g: 0,
        b: 0,
      },
    },
  ],
});

/** A team library's Heading set: each variant holds a label box with a text. */
function heading(): FakeNode {
  const set = tree({
    id: "7:1",
    name: "Heading",
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      "Property 1": {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Green"],
      },
    },
    children: [
      {
        id: "7:2",
        name: "Property 1=Default",
        type: "COMPONENT",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "3:4",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("3:5", "Title")],
          },
        ],
      },
      {
        id: "7:3",
        name: "Property 1=Green",
        type: "COMPONENT",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "3:6",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("3:7", "Title")],
          },
        ],
      },
    ],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

let root: FakeNode;
let library: FakeNode;
let fake: ReturnType<typeof installFigma>;
let apply: ReturnType<typeof pipeline>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) => [...all(root), ...all(library), ...fake.writes.created].find((node) => node.id === id);

beforeEach(() => {
  library = heading();

  const main = library.children?.[0] as FakeNode;

  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "1:5",
            name: "Heading and link",
            layoutMode: "VERTICAL",
            children: [text("1:2", "Hello"), text("1:6", "Read more", "Space Grotesk", "Medium")],
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        children: [],
      },
      {
        id: "9:1",
        name: "Row",
        layoutMode: "HORIZONTAL",
        children: ["A", "B", "C"].map((name, index) => ({
          id: `9:${index + 2}`,
          type: "RECTANGLE",
          name,
        })),
      },
      {
        id: "2:1",
        name: "Heading",
        type: "INSTANCE",
        layoutMode: "VERTICAL",
        mainComponent: main,
        componentProperties: {
          "Property 1": {
            type: "VARIANT",
            value: "Default",
          },
        },
        children: [
          {
            id: "I2:1;3:4",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("I2:1;3:5", "Search engine")],
          },
        ],
      },
    ],
  });
  fake = installFigma(root, {
    components: [library],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
      {
        family: "Space Grotesk",
        style: "Medium",
      },
    ],
  });
  apply = pipeline();
  setEditsAllowed(true);
});

afterEach(() => {
  setEditsAllowed(false);
});

describe("design_apply end to end: copies and new instances", () => {
  it("writes a layer deep inside a copy, the source untouched", async () => {
    const result = await apply(
      '<Frame id="3:1"><Frame copyOf="1:1" name="Card 2"><Frame id="1:5"><Text id="1:2">Copied title</Text></Frame></Frame></Frame>',
    );
    const copy = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(copy?.children?.[0]?.children?.[0]?.characters).toBe("Copied title");
    expect(byId("1:2")?.characters).toBe("Hello");
  });

  it("loads the fonts of a copy's texts before retyping them", async () => {
    const result = await apply('<Frame copyOf="1:1"><Frame id="1:5"><Text id="1:6">More</Text></Frame></Frame>', {
      parent: "3:1",
    });

    expect(result.errors).toEqual([]);
  });

  it("writes another instance's layer ids onto the new instance's own, never the other one's", async () => {
    const result = await apply(
      '<Frame id="3:1"><Instance component="Heading"><Frame id="I2:1;3:4"><Text id="I2:1;3:5">Our work</Text></Frame></Instance></Frame>',
    );
    const made = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(byId("I2:1;3:5")?.characters).toBe("Search engine");
    expect(made?.children?.[0]?.children?.[0]?.characters).toBe("Our work");
  });

  it("writes a new instance's layer as the XML says, even what the other instance it was read from has", async () => {
    const result = await apply(
      '<Frame id="3:1"><Instance component="Heading"><Frame id="I2:1;3:4"><Text id="I2:1;3:5">Search engine</Text></Frame></Instance></Frame>',
    );
    const made = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(made?.children?.[0]?.children?.[0]?.characters).toBe("Search engine");
  });

  it("switches the variant of a copy of an instance", async () => {
    const result = await apply('<Frame id="3:1"><Instance copyOf="2:1" variant="Property 1=Green"/></Frame>');

    expect(result.errors).toEqual([]);
    expect((byId(result.created[0]?.id ?? "") as FakeNode).mainComponent).toMatchObject({ id: "7:3" });
  });
});

describe("design_apply end to end: dry runs and moves", () => {
  it("checks an instance of a component the same XML makes, and a copy of an instance, without errors", async () => {
    const result = await apply(
      '<ComponentSet name="Tag"><Component variant="Tone=Dark"><Text prop="Label">A</Text></Component></ComponentSet>\n<Instance component="Tag" variant="Tone=Dark"/>\n<Instance copyOf="2:1"/>',
      {
        parent: "3:1",
        dryRun: true,
      },
    );

    expect(result.errors).toEqual([]);
  });

  it("moves a layer forward past the others, as Figma counts the index with the layer still in place", async () => {
    const result = await apply(
      '<Frame id="9:1"><Rectangle id="9:3"/><Rectangle id="9:4"/><Rectangle id="9:2"/></Frame>',
    );

    expect(result.errors).toEqual([]);
    expect(byId("9:1")?.children?.map(({ id }) => id)).toEqual(["9:3", "9:4", "9:2"]);
  });

  it("moves a nested layer before another, lists it as changed, in one undo step", async () => {
    const result = await apply('<Frame id="1:5"><Text id="1:6" before="1:2"/></Frame>');

    expect(byId("1:5")?.children?.map(({ id }) => id)).toEqual(["1:6", "1:2"]);
    expect(result.changed).toEqual(["1:6"]);
    expect(fake.writes.undo).toBe(1);
  });
});
