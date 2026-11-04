import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { StrokesGroup } from "@/core/css/groups/paint/strokes-group.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const format = new NumberFormat();
const solid = new SolidPaint(new TokenNames());
const gradients = new GradientCss(
  new GradientGeometry(),
  solid,
  new CssLength(new CssVar(new CssSplit()), format, new TokenNames()),
  format,
);
const group = new StrokesGroup(
  new PaintList(solid, gradients, new ImagePaint(new CssUrl(new CssSplit())), new TokenNames()),
  format,
);
const DARK = [{ type: "SOLID", color: { r: 25 / 255, g: 26 / 255, b: 35 / 255 } }];

function cssOf(fields: Partial<ReadLayer>) {
  const css = new CssDeclarations();
  const own: ReadLayer = {
    id: "1:2",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    childCount: 0,
    strokes: DARK,
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    ...fields,
  };

  group.read({
    layer: own,
    parent: null,
    model: { model: 1, profile: "design", root: own, styles: {}, variables: {} },
    css,
  });

  return css.build();
}

function line(fields: Partial<ReadLayer>) {
  return cssOf({ type: "LINE", height: 0, strokeAlign: "CENTER", ...fields });
}

describe("StrokesGroup", () => {
  // C-090: inside keeps the box (border-box), outside draws past it (outline).
  it("writes an inside stroke as a border and an outside one as an outline, weights to 2 decimals", () => {
    expect(cssOf({ strokeWeight: 2.5 }).properties).toEqual([["border", "2.5px solid #191A23"]]);
    expect(cssOf({ strokeAlign: "OUTSIDE", dashPattern: [4, 4] }).properties).toEqual([
      ["outline", "1px dashed #191A23"],
    ]);
  });

  it("writes a centred stroke as a border with a stroke-align note: half of it lies outside the box", () => {
    const read = cssOf({ strokeAlign: "CENTER" });

    expect(read.properties).toEqual([["border", "1px solid #191A23"]]);
    expect(read.notes).toEqual([["stroke-align", "center"]]);
  });

  it("writes per-side weights as a border per side, only the sides drawn", () => {
    const sides = { strokeTopWeight: 1, strokeRightWeight: 0, strokeBottomWeight: 2, strokeLeftWeight: 0 };

    expect(cssOf({ strokeWeight: "mixed", ...sides }).properties).toEqual([
      ["border-top", "1px solid #191A23"],
      ["border-bottom", "2px solid #191A23"],
    ]);
  });

  it("writes nothing without a visible stroke, and the fixed note for a stroke it cannot write (D-20)", () => {
    expect(cssOf({ strokes: [] }).properties).toEqual([]);
    expect(cssOf({ strokes: [{ type: "GRADIENT_LINEAR" }], css: { border: "figma's own" } }).notes).toEqual([
      ["border", "a gradient or other stroke the table cannot write yet"],
    ]);
  });

  // A text's stroke is -webkit-text-stroke, centred on the glyph's edge; outside is twice as wide under the fill.
  it("writes a text's stroke as -webkit-text-stroke, an outside one doubled and painted under the fill", () => {
    const outside = cssOf({ type: "TEXT", strokeWeight: 2, strokeAlign: "OUTSIDE" });
    const inside = cssOf({ type: "TEXT", strokeWeight: 2 });

    expect(outside.properties).toEqual([
      ["-webkit-text-stroke", "4px #191A23"],
      ["paint-order", "stroke fill"],
    ]);
    expect(inside.properties).toEqual([["-webkit-text-stroke", "2px #191A23"]]);
    expect(inside.notes).toEqual([["stroke-align", "inside"]]);
    expect(cssOf({ type: "TEXT", strokes: [{ type: "GRADIENT_LINEAR" }] }).notes).toEqual([
      ["-webkit-text-stroke", "a gradient or other stroke the table cannot write yet"],
    ]);
  });

  // The line as one border: flat is border-top, standing (within half a degree) border-left, any other angle a turned
  // flat line; a centred stroke and a round cap are notes.
  it("draws a line as one border: top when it lies flat or turned, left when it stands", () => {
    expect(line({}).properties).toEqual([["border-top", "1px solid #191A23"]]);
    expect(line({ rotation: 90.2 }).properties).toEqual([["border-left", "1px solid #191A23"]]);
    expect(line({ rotation: -90 }).properties).toEqual([["border-left", "1px solid #191A23"]]);
    expect(line({ rotation: 60 }).properties).toEqual([["border-top", "1px solid #191A23"]]);
    expect(line({ strokeCap: "ROUND" }).notes).toEqual([
      ["stroke-align", "center"],
      ["stroke-linecap", "round"],
    ]);
    expect(line({ strokes: [] }).properties).toEqual([["border-top", "1px solid currentColor"]]);
  });
});
