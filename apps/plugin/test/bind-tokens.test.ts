import type { BindOutput } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const rgb = (hex: number) => ({
  r: ((hex >> 16) & 255) / 255,
  g: ((hex >> 8) & 255) / 255,
  b: (hex & 255) / 255,
});

const solid = (hex: number, opacity = 1) => ({
  type: "SOLID",
  visible: true,
  opacity,
  blendMode: "NORMAL",
  color: rgb(hex),
});

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  blendMode: "NORMAL",
  color: {
    ...rgb(0x000000),
    a: 0.2,
  },
  offset: {
    x: 0,
    y: 4,
  },
  radius: 12,
  spread: 0,
};

const FONT = {
  family: "Inter",
  style: "Semi Bold",
};

const COLLECTION = {
  id: "C:1",
  name: "Theme",
  remote: false,
  defaultModeId: "M:1",
  modes: [
    {
      modeId: "M:1",
      name: "Light",
    },
  ],
};

const variable = (id: string, name: string, value: unknown, scopes = ["ALL_SCOPES"]) => ({
  id,
  name,
  variableCollectionId: "C:1",
  resolvedType: typeof value === "number" ? "FLOAT" : "COLOR",
  scopes,
  codeSyntax: {},
  valuesByMode: { "M:1": value },
});

let page: FakeNode;
let writes: ReturnType<typeof installFigma>["writes"];

const byId = (id: string): FakeNode => {
  const find = (node: FakeNode): FakeNode | undefined =>
    node.id === id ? node : (node.children ?? []).map(find).find((found) => found !== undefined);

  return find(page) as FakeNode;
};

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        type: "FRAME",
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        paddingTop: 24,
        fills: [solid(0xffffff)],
        fillStyleId: "",
        strokes: [solid(0x3b2fd9)],
        strokeStyleId: "",
        topLeftRadius: 12,
        topRightRadius: 12,
        bottomRightRadius: 12,
        bottomLeftRadius: 12,
        effects: [SHADOW],
        effectStyleId: "",
        inferredVariables: {
          itemSpacing: [
            {
              type: "VARIABLE_ALIAS",
              id: "V:space-4",
            },
          ],
        },
        children: [
          {
            id: "1:2",
            name: "Title",
            type: "TEXT",
            characters: "Plans",
            fontName: FONT,
            fontSize: 16,
            lineHeight: {
              unit: "PIXELS",
              value: 24,
            },
            letterSpacing: {
              unit: "PIXELS",
              value: 0,
            },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
            textStyleId: "",
            fills: [solid(0x14161f)],
            fillStyleId: "",
          },
          {
            id: "1:3",
            name: "Badge",
            type: "RECTANGLE",
            fills: [solid(0x00ff00)],
            fillStyleId: "",
          },
          {
            id: "1:4",
            name: "Button",
            type: "INSTANCE",
            fills: [solid(0xffffff)],
            fillStyleId: "",
          },
        ],
      },
    ],
  });
  ({ writes } = installFigma(page, {
    localCollections: [COLLECTION],
    localVariables: [
      variable("V:surface", "surface", {
        ...rgb(0xffffff),
        a: 1,
      }),
      variable("V:paper", "paper", {
        ...rgb(0xffffff),
        a: 1,
      }),
      variable("V:brand", "brand", {
        ...rgb(0x3b2fd9),
        a: 1,
      }),
      variable(
        "V:ink",
        "ink",
        {
          ...rgb(0x14161f),
          a: 1,
        },
        ["TEXT_FILL"],
      ),
      variable("V:space-4", "space/4", 16, ["GAP"]),
      variable("V:radius", "radius/m", 12, ["CORNER_RADIUS"]),
      variable("V:accent", "accent", {
        ...rgb(0x5a4ff0),
        a: 1,
      }),
    ],
    localStyles: {
      text: [
        {
          id: "S:label",
          type: "TEXT",
          name: "Label",
          remote: false,
          fontName: FONT,
          fontSize: 16,
          lineHeight: {
            unit: "PIXELS",
            value: 24,
          },
          letterSpacing: {
            unit: "PIXELS",
            value: 0,
          },
          textCase: "ORIGINAL",
          textDecoration: "NONE",
        },
      ],
      effect: [
        {
          id: "S:card",
          type: "EFFECT",
          name: "Card shadow",
          remote: false,
          effects: [SHADOW],
        },
      ],
    },
    fonts: [FONT],
  }));
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const run = (input: Record<string, unknown>) =>
  plugin.run("bind", {
    roots: ["1:1"],
    ...input,
  }) as Promise<BindOutput>;

const boundTokens = (output: BindOutput) =>
  output.bound.map(({ field, value, token, count }) => `${field} ${value} → ${token} ×${count}`);

describe("bind: raw values bound to the one token that holds each", () => {
  it("binds colours, numbers, a text style and an effect style, and lists what has no token or several", async () => {
    const output = await run({});

    expect(output.errors).toEqual([]);
    expect(boundTokens(output)).toEqual([
      "border #3B2FD9 → --brand ×1",
      "gap 16px → --space-4 ×1",
      "border-radius 12px → --radius-m ×1",
      "effects box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.2) → --Card-shadow ×1",
      "color #14161F → --ink ×1",
      "font 600 16px/24px 'Inter' → --Label-font ×1",
    ]);
    expect(output.ambiguous.map(({ value, candidates }) => `${value}: ${candidates.join(" ")}`)).toEqual([
      "#FFF: --surface --paper",
    ]);
    expect(output.unmatched.map(({ field, value }) => `${field} ${value}`)).toEqual([
      "padding 24px",
      "background #0F0",
    ]);
    expect(output.layers).toBe(2);

    const card = byId("1:1");

    expect(card.strokes).toMatchObject([{ boundVariables: { color: { id: "V:brand" } } }]);
    expect(card.boundVariables).toMatchObject({
      itemSpacing: { id: "V:space-4" },
      topLeftRadius: { id: "V:radius" },
      bottomLeftRadius: { id: "V:radius" },
    });
    expect(card.effectStyleId).toBe("S:card");
    expect(card.fills).toEqual([solid(0xffffff)]);
    expect(writes.calls.filter(({ method }) => method === "setRangeTextStyleIdAsync")).toEqual([
      {
        node: "1:2",
        method: "setRangeTextStyleIdAsync",
        args: [0, 5, "S:label"],
      },
    ]);
    expect(byId("1:2").fills).toMatchObject([{ boundVariables: { color: { id: "V:ink" } } }]);
    expect(writes.undo).toBe(1);
  });

  it("leaves instances to their components and says so", async () => {
    const output = await run({});

    expect(byId("1:4").fills).toEqual([solid(0xffffff)]);
    expect(output.notes).toEqual(["1 instance was left alone: bind its main component, and its instances follow."]);
  });

  it("takes the call's pick for a value several tokens hold, and snaps a value to a token when asked", async () => {
    const output = await run({
      kinds: ["color"],
      choose: [
        {
          value: "#FFF",
          token: "--paper",
        },
        {
          value: "#0F0",
          token: "--accent",
        },
      ],
    });

    expect(output.ambiguous).toEqual([]);
    expect(output.bound.filter(({ token }) => token === "--paper" || token === "--accent")).toMatchObject([
      {
        field: "background",
        value: "#FFF",
        token: "--paper",
      },
      {
        field: "background",
        value: "#0F0",
        token: "--accent",
        snapped: true,
      },
    ]);
    expect(byId("1:3").fills).toMatchObject([{ boundVariables: { color: { id: "V:accent" } } }]);
  });

  it("names a pick that is not a token of the value's kind", async () => {
    const output = await run({
      kinds: ["color"],
      choose: [
        {
          value: "#0F0",
          token: "--space-4",
        },
      ],
    });

    expect(output.errors).toEqual([
      {
        id: "1:3",
        message: "--space-4 is no colour token: give a colour variable or a paint style.",
      },
    ]);
  });

  it("writes nothing in a dry run, which works with Allow edits off", async () => {
    plugin.services.edits.allow(false);

    const output = await run({ dryRun: true });

    expect(output.bound.length).toBe(6);
    expect(writes.calls).toEqual([]);
    expect(writes.undo).toBe(0);
  });

  it("is refused while Allow edits is off", async () => {
    plugin.services.edits.allow(false);

    await expect(run({})).rejects.toThrow(/Allow edits/);
  });
});

describe("bind: one token's uses rebound to another", () => {
  it("rebinds paints and fields bound to a variable, and leaves raw values alone", async () => {
    await run({ kinds: ["color", "number"] });

    const output = await run({
      remap: [
        {
          from: "--brand",
          to: "--accent",
        },
        {
          from: "--space-4",
          to: "--radius-m",
        },
      ],
    });

    expect(output.errors).toEqual([]);
    expect(output.remapped).toEqual([
      {
        from: "--brand",
        to: "--accent",
        count: 1,
      },
      {
        from: "--space-4",
        to: "--radius-m",
        count: 1,
      },
    ]);
    expect(byId("1:1").strokes).toMatchObject([{ boundVariables: { color: { id: "V:accent" } } }]);
    expect(byId("1:1").boundVariables).toMatchObject({ itemSpacing: { id: "V:radius" } });
    expect(byId("1:1").fills).toEqual([solid(0xffffff)]);
  });

  it("refuses to rebind a token to one of another kind", async () => {
    const output = await run({
      remap: [
        {
          from: "--brand",
          to: "--Label-font",
        },
      ],
    });

    expect(output.remapped).toEqual([]);
    expect(output.errors).toEqual([
      {
        id: "--brand",
        message: "--brand is a colour variable and --Label-font a text style: rebind a token to one of its own kind.",
      },
    ]);
  });
});
