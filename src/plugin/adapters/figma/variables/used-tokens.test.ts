import { describe, expect, it } from "vitest";
import { LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { UsedTokens } from "@/plugin/adapters/figma/variables/used-tokens.ts";

/** Figma's figma.mixed: a symbol in a field whose value differs between a text's runs. */
const MIXED = Symbol("mixed");

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

const layer = (fields: object): SceneNode => fields as SceneNode;

/** A price whose second run alone has the Accent paint style, a fill bound to V:ink and a font size bound to V:size. */
const price = layer({
  id: "1:3",
  type: "TEXT",
  name: "Price",
  fillStyleId: MIXED,
  strokeStyleId: "",
  effectStyleId: "",
  textStyleId: "S:body",
  fills: MIXED,
  boundVariables: {},
  getStyledTextSegments: () => [
    { fillStyleId: "", textStyleId: "S:body", fills: [], boundVariables: {} },
    {
      fillStyleId: "S:accent",
      textStyleId: "S:body",
      fills: [{ type: "SOLID", boundVariables: { color: alias("V:ink") } }],
      boundVariables: { fontSize: alias("V:size") },
    },
  ],
});

const card = layer({
  id: "1:2",
  type: "FRAME",
  name: "Card",
  boundVariables: { paddingLeft: alias("V:space") },
  children: [price],
});

const walk = new LayerWalk({ now: () => 0 });

const used = new UsedTokens(walk, new NodeLookup());

describe("UsedTokens", () => {
  it("takes the styles and variables a text's runs use where the text says mixed (P-096, O-024)", () => {
    const found = used.under(card, walk.deadline());

    expect(found.styles).toEqual(expect.arrayContaining(["S:body", "S:accent"]));
    expect(found.variables).toEqual(expect.arrayContaining(["V:space", "V:ink", "V:size"]));
  });

  it("says where a layer uses a style or variable: its field, or a text run when only a run has it (T-106, O-024)", () => {
    expect(used.where(price, "S:body", false)).toBe("text");
    expect(used.where(price, "S:accent", false)).toBe("a text run");
    expect(used.where(price, "V:ink", true)).toBe("a text run");
    expect(used.where(card, "V:space", true)).toBe("paddingLeft");
    expect(used.where(card, "S:accent", false)).toBeNull();
  });
});
