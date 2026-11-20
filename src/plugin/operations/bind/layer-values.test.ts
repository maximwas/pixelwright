import { describe, expect, it } from "vitest";
import { LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { UsedTokens } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import { LayerValues } from "@/plugin/operations/bind/layer-values.ts";

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

const RAW = { kinds: ["color", "number", "text", "effect"] as const, remap: [], overrides: false };

/** A layer whose variable modes and inferred variables count how often Figma is asked for them. */
function layer(fields: object) {
  const asked = { modes: 0, inferred: 0 };
  const node = {
    id: "1:2",
    type: "RECTANGLE",
    fillStyleId: "",
    strokeStyleId: "",
    effectStyleId: "",
    fills: [],
    strokes: [],
    effects: [],
    opacity: 1,
    boundVariables: {},
    ...fields,
    get resolvedVariableModes() {
      asked.modes += 1;

      return { c: "light" };
    },
    get inferredVariables() {
      asked.inferred += 1;

      return { fills: [[], [alias("V:lib")]], opacity: [alias("V:half")] };
    },
  };

  return { node: node as never as SceneNode, asked };
}

const solid = (red: number) => ({ type: "SOLID", color: { r: red, g: 0, b: 0 }, opacity: 1 });

const values = new LayerValues(new UsedTokens(new LayerWalk({ now: () => 0 }), new NodeLookup()), new NodeLookup());

describe("LayerValues", () => {
  it("asks Figma for no modes and no inferred variables of a layer with nothing to bind", () => {
    const { node, asked } = layer({});

    expect(values.scan(node, { ...RAW, kinds: [...RAW.kinds] })).toBeNull();
    expect(asked).toEqual({ modes: 0, inferred: 0 });
  });

  it("keeps each raw paint's index in its list and the variables Figma infers for it and for a raw number (P-164)", () => {
    const fills = [{ ...solid(1), boundVariables: { color: alias("V:red") } }, solid(0.5)];
    const { node, asked } = layer({ fills, opacity: 0.5 });
    const scanned = values.scan(node, { ...RAW, kinds: [...RAW.kinds] });

    expect(scanned).toMatchObject({
      modes: { c: "light" },
      paints: [{ at: "fills", index: 1, opacity: 1, stylable: false, inferred: ["V:lib"] }],
      inferred: { opacity: ["V:half"] },
    });
    expect(asked).toEqual({ modes: 1, inferred: 1 });
  });

  it("keeps a text run's range, for its colour and for its text style (T-167)", () => {
    const run = {
      start: 2,
      end: 5,
      fills: [solid(1)],
      fillStyleId: "",
      textStyleId: "",
      fontName: { family: "Inter", style: "Regular" },
      fontSize: 16,
      lineHeight: { unit: "AUTO" },
      letterSpacing: { unit: "PIXELS", value: 0 },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    };
    const { node } = layer({ type: "TEXT", fills: Symbol("mixed"), getStyledTextSegments: () => [run] });
    const scanned = values.scan(node, { ...RAW, kinds: [...RAW.kinds] });

    expect(scanned?.paints).toEqual([
      { at: "run", index: 0, range: { start: 2, end: 5 }, color: { r: 1, g: 0, b: 0 }, opacity: 1, stylable: true },
    ]);
    expect(scanned?.texts.map(({ range }) => range)).toEqual([{ start: 2, end: 5 }]);
  });
});
