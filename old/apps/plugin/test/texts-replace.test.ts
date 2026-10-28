import type { TextsOutput } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const INTER = {
  family: "Inter",
  style: "Regular",
};

const text = (id: string, characters: string, fields: Record<string, unknown> = {}) => ({
  id,
  type: "TEXT",
  name: characters,
  characters,
  fontName: INTER,
  ...fields,
});

let page: FakeNode;
let writes: ReturnType<typeof installFigma>["writes"];

const byId = (id: string): FakeNode => {
  const find = (at: FakeNode): FakeNode | undefined =>
    at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

  return find(page) as FakeNode;
};

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Pricing",
        children: [
          text("1:2", "Sign in to start your Pro plan"),
          text("1:3", "Pro plans renew yearly"),
          text("1:4", "Missing font Pro", {
            fontName: {
              family: "Gone Sans",
              style: "Regular",
            },
          }),
          {
            id: "1:5",
            name: "Badge",
            type: "INSTANCE",
            componentProperties: {
              "Label#2:1": {
                type: "TEXT",
                value: "Pro",
              },
            },
            children: [
              text("I1:5;2:2", "Pro", {
                componentPropertyReferences: { characters: "Label#2:1" },
              }),
            ],
          },
        ],
      },
    ],
  });
  ({ writes } = installFigma(page, {
    fonts: [INTER],
    unloadable: [
      {
        family: "Gone Sans",
        style: "Regular",
      },
    ],
  }));
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const run = (input: Record<string, unknown>) =>
  plugin.run("texts", {
    roots: ["1:1"],
    ...input,
  }) as Promise<TextsOutput>;

describe("texts: find and replace under layers", () => {
  it("replaces in every text, each match where it was so its run keeps its style", async () => {
    const output = await run({
      replacements: [
        {
          find: "Pro",
          replace: "Plus",
          caseSensitive: true,
        },
      ],
    });

    expect(output.changed.map(({ id, after, count }) => `${id} ${after} ×${count}`)).toEqual([
      "1:2 Sign in to start your Plus plan ×1",
      "1:3 Plus plans renew yearly ×1",
      "I1:5;2:2 Plus ×1",
    ]);
    expect(byId("1:2").characters).toBe("Sign in to start your Plus plan");
    // The new characters go in after the match, taking its last character's style, before the match goes.
    expect(
      writes.calls.filter(({ node }) => node === "1:2").map(({ method, args }) => `${method} ${args.join(",")}`),
    ).toEqual(["insertCharacters 25,Plus,BEFORE", "deleteCharacters 22,25"]);
    expect(output).toMatchObject({
      texts: 3,
      count: 3,
    });
    expect(writes.undo).toBe(1);
  });

  it("changes a text an instance shows from a component property through the property", async () => {
    const output = await run({
      replacements: [
        {
          find: "Pro",
          replace: "Plus",
          wholeWord: true,
        },
      ],
    });

    expect(output.changed.find(({ id }) => id === "I1:5;2:2")?.property).toBe("Label");
    expect(writes.calls.filter(({ method }) => method === "setProperties")).toEqual([
      {
        node: "1:5",
        method: "setProperties",
        args: [{ "Label#2:1": "Plus" }],
      },
    ]);
  });

  it("names a text whose font is missing and changes the others", async () => {
    const output = await run({
      replacements: [
        {
          find: "Pro",
          replace: "Plus",
        },
      ],
    });

    expect(output.errors).toEqual([
      {
        id: "1:4",
        message: "Its font Gone Sans Regular is not on this machine: install it, or change the text in Figma.",
      },
    ]);
    expect(byId("1:4").characters).toBe("Missing font Pro");
  });

  it("writes nothing in a dry run, which works with Allow edits off", async () => {
    plugin.services.edits.allow(false);

    const output = await run({
      replacements: [
        {
          find: "yearly",
          replace: "every year",
        },
      ],
      dryRun: true,
    });

    expect(output.changed).toEqual([
      {
        id: "1:3",
        name: "Pro plans renew yearly",
        before: "Pro plans renew yearly",
        after: "Pro plans renew every year",
        count: 1,
      },
    ]);
    expect(writes.calls).toEqual([]);
  });

  it("is refused while Allow edits is off", async () => {
    plugin.services.edits.allow(false);

    await expect(
      run({
        replacements: [
          {
            find: "a",
            replace: "b",
          },
        ],
      }),
    ).rejects.toThrow(/Allow edits/);
  });
});
