import { describe, expect, it } from "vitest";
import { EffectMerge } from "@/core/css/groups/effects/effect-merge.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";

const merge = new EffectMerge(new TokenNames());
const black = { r: 0, g: 0, b: 0, a: 0.25 };

describe("EffectMerge", () => {
  // O-015, C-103: what CSS cannot name stays where it was; a shadow that looks the same keeps its variable and blend.
  it("keeps noise, hidden effects and a held shadow's own fields when CSS writes the list", () => {
    const noise = { type: "NOISE", visible: true, noiseSize: 2 };
    const held = {
      type: "DROP_SHADOW",
      visible: true,
      radius: 8,
      spread: 0,
      offset: { x: 0, y: 4 },
      color: black,
      blendMode: "MULTIPLY",
      showShadowBehindNode: true,
    };
    const hidden = { type: "LAYER_BLUR", visible: false, radius: 30 };
    const blur = { type: "LAYER_BLUR", visible: true, radius: 10 };
    const shadow = { type: "DROP_SHADOW", visible: true, radius: 8, spread: 0, offset: { x: 0, y: 4 }, color: black };

    expect(merge.merged([noise, held, hidden], [blur, shadow])).toEqual([noise, blur, hidden, held]);
  });

  it("writes a shadow bound to a variable over a held one of the same colour that is not bound", () => {
    const held = { type: "DROP_SHADOW", radius: 2, offset: { x: 0, y: 1 }, color: black };
    const bound = { ...held, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "VariableID:1" } } };

    expect(merge.merged([held], [bound])).toEqual([bound]);
  });
});
