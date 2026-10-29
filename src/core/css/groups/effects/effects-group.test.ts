import { describe, expect, it } from "vitest";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const group = new EffectsGroup(new SolidPaint(), new CssLength(new CssVar(new CssSplit()), format), format);

type Effect = NonNullable<ReadLayer["effects"]>[number];

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const SOFT = { r: 0.08, g: 0.09, b: 0.12, a: 0.16 };
const CARD = { type: "DROP_SHADOW", visible: true, color: SOFT, offset: { x: 0, y: 4 }, radius: 12, spread: 0 };
const RIM = { type: "INNER_SHADOW", visible: true, color: BLACK, offset: { x: 0, y: 2 }, radius: 4, spread: 1 };

function blur(
  type: string,
  radius: number,
  extra: Partial<Effect> = {},
): Effect {
  return { type, visible: true, radius, ...extra };
}

function cssOf(fields: Partial<ReadLayer>, model: Partial<ReadModel> = {}) {
  const css = new CssDeclarations();
  const layer: ReadLayer = {
    id: "1:2",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    childCount: 0,
    ...fields,
  };

  group.read({
    layer,
    parent: null,
    model: { model: 1, profile: "design", root: layer, styles: {}, variables: {}, ...model },
    css,
  });

  return css.build();
}

describe("EffectsGroup", () => {
  // C-100, FX-056 (m:734ea40e): Figma renders radius R as a Gaussian of about 0.43 R; two decimals.
  it("reads a layer blur of radius 20 as blur(8.6px), a background blur alike, and 13.3 as blur(5.72px)", () => {
    expect(cssOf({ effects: [blur("LAYER_BLUR", 20), blur("BACKGROUND_BLUR", 13.3)] }).properties).toEqual([
      ["filter", "blur(8.6px)"],
      ["backdrop-filter", "blur(5.72px)"],
    ]);
  });

  // C-101, FX-058: Figma keeps effects bottom to top, CSS lists shadows top first; hidden ones left out.
  it("reads shadows top first with inset for the inner one, hidden ones left out", () => {
    expect(cssOf({ effects: [CARD, { ...CARD, visible: false }, RIM] }).properties).toEqual([
      ["box-shadow", "inset 0 2px 4px 1px #000, 0 4px 12px 0 rgba(20, 23, 31, 0.16)"],
    ]);
  });

  it("reads a text's drop shadows as text-shadow, without spread or inner shadows", () => {
    expect(cssOf({ type: "TEXT", effects: [CARD, RIM] }).properties).toEqual([
      ["text-shadow", "0 4px 12px rgba(20, 23, 31, 0.16)"],
    ]);
  });

  it("reads a shadow colour bound to a variable as its token, and an effect style as the style's token", () => {
    const bound = { ...CARD, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "V:shadow" } } };
    const variables = {
      "V:shadow": { name: "shadow/soft", collection: "Theme", resolvedType: "COLOR", remote: false, value: SOFT },
    };
    const styles = { "S:card,": { name: "Shadow/Card", type: "EFFECT", remote: false, effects: [CARD] } };

    expect(cssOf({ effects: [bound] }, { variables }).properties).toEqual([
      ["box-shadow", "0 4px 12px 0 var(--shadow-soft)"],
    ]);
    expect(cssOf({ effects: [CARD, blur("LAYER_BLUR", 20)], effectStyleId: "S:card," }, { styles }).properties).toEqual(
      [
        ["box-shadow", "var(--Shadow-Card)"],
        ["filter", "blur(8.6px)"],
      ],
    );
  });

  // C-102: CSS has no blur that changes across a box: the end radius, and how it runs as a note.
  it("reads a progressive blur as its end radius and a note, and an effect CSS lacks as a note", () => {
    const progressive = blur("LAYER_BLUR", 20, {
      blurType: "PROGRESSIVE",
      startRadius: 0,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 },
    });
    const read = cssOf({ effects: [progressive, { type: "NOISE", visible: true }] });

    expect(read.properties).toEqual([["filter", "blur(8.6px)"]]);
    expect(read.notes).toEqual([
      ["blur", "progressive from 0px at 50% 0% to 8.6px at 50% 100%"],
      ["effect", "noise: CSS has none, the layer reads as an image"],
    ]);
  });
});
