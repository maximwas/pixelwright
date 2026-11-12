import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
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
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const solid = new SolidPaint(new TokenNames());
const gradients = new GradientCss(
  new GradientGeometry(),
  solid,
  new CssLength(new CssVar(new CssSplit()), format, new TokenNames()),
  format,
);
const group = new FillsGroup(
  new PaintList(solid, gradients, new ImagePaint(new CssUrl(new CssSplit())), new TokenNames()),
);
const RED = { r: 1, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 1 };

function layer(fields: Partial<ReadLayer>): ReadLayer {
  return {
    id: "1:2",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    childCount: 0,
    ...fields,
  };
}

function cssOf(fields: Partial<ReadLayer>, styles: ReadModel["styles"] = {}) {
  const css = new CssDeclarations();
  const own = layer(fields);

  group.read({
    layer: own,
    parent: null,
    model: { model: 1, profile: "design", root: own, styles, variables: {} },
    css,
  });

  return css.build();
}

describe("FillsGroup", () => {
  // C-080: Figma's paints are bottom first, CSS's backgrounds top first; only the bottom one may be a plain colour.
  it("writes fills as a top-first background list, a solid above the bottom as a flat gradient, hidden ones left out", () => {
    expect(
      cssOf({
        fills: [
          { type: "SOLID", color: RED },
          { type: "SOLID", color: { r: 0, g: 1, b: 0 }, visible: false },
          { type: "SOLID", color: BLUE, opacity: 0.5 },
        ],
      }).properties,
    ).toEqual([["background", "linear-gradient(rgba(0, 0, 255, 0.5), rgba(0, 0, 255, 0.5)), #F00"]]);
  });

  it("writes a text's fill as its color, and nothing for a vector's", () => {
    expect(cssOf({ type: "TEXT", fills: [{ type: "SOLID", color: BLUE }] }).properties).toEqual([["color", "#00F"]]);
    expect(cssOf({ type: "VECTOR", fills: [{ type: "SOLID", color: BLUE }] }).properties).toEqual([]);
  });

  it("writes a fill bound to a paint style as the style's token", () => {
    const styles = { "S:1,": { name: "Orbit/Gradient", type: "PAINT", remote: false, paints: [] } };

    expect(cssOf({ fills: [{ type: "SOLID", color: RED }], fillStyleId: "S:1," }, styles).properties).toEqual([
      ["background", "var(--Orbit-Gradient)"],
    ]);
  });

  // C-082: an image as its file, FILL and CROP covering, FIT contained, TILE repeated.
  it("writes an image fill as its url with the scale mode's size and repeat", () => {
    const image = (scaleMode: string) => cssOf({ fills: [{ type: "IMAGE", imageHash: "abc", scaleMode }] }).properties;

    expect(image("FILL")).toEqual([["background", "url(assets/abc.png) center / cover no-repeat"]]);
    expect(image("CROP")).toEqual([["background", "url(assets/abc.png) center / cover no-repeat"]]);
    expect(image("FIT")).toEqual([["background", "url(assets/abc.png) center / contain no-repeat"]]);
    expect(image("TILE")).toEqual([["background", "url(assets/abc.png) repeat"]]);
  });

  // C-083: a gradient above the bottom layer is a layer of its own, not wrapped as a flat solid is.
  it("writes a gradient above an image as its own layer, and a text's gradient as the note", () => {
    const gradient = {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
    };

    expect(cssOf({ fills: [{ type: "IMAGE", imageHash: "abc", scaleMode: "FILL" }, gradient] }).properties).toEqual([
      ["background", "linear-gradient(90deg, #F00 0%, #00F 100%), url(assets/abc.png) center / cover no-repeat"],
    ]);
    expect(cssOf({ type: "TEXT", fills: [gradient] }).notes).toEqual([["color", "a gradient or image fill"]]);
  });

  // A fill's blend mode blends it with the fills under it: one background-blend-mode per background, top first.
  it("writes the fills' blend modes as background-blend-mode, a mode CSS lacks and a text's as notes", () => {
    const over = (blendMode: string) => [
      { type: "SOLID", color: BLUE },
      { type: "SOLID", color: RED, blendMode },
    ];
    const multiply = cssOf({ fills: over("MULTIPLY") });
    const burn = cssOf({ fills: over("LINEAR_BURN") });
    const text = cssOf({ type: "TEXT", fills: [{ type: "SOLID", color: RED, blendMode: "MULTIPLY" }] });

    expect(multiply.properties).toEqual([
      ["background", "linear-gradient(#F00, #F00), #00F"],
      ["background-blend-mode", "multiply, normal"],
    ]);
    expect(burn.properties.map(([property]) => property)).toEqual(["background"]);
    expect(burn.notes).toEqual([["background-blend-mode", "linear-burn, normal"]]);
    expect(text.notes).toEqual([["fill-blend-mode", "multiply"]]);
  });

  // D-20: a paint the table cannot write gets the fixed note, never Figma's own CSS (getCSSAsync hangs and is wrong).
  it("notes a paint it cannot write with the fixed text, not Figma's CSS", () => {
    const read = cssOf({ fills: [{ type: "GRADIENT_DIAMOND" }], css: { background: "figma's own" } });

    expect(read.properties).toEqual([]);
    expect(read.notes).toEqual([["background", "a gradient or other fill the table cannot write yet"]]);
  });

  // B-001, D-23: a video fill is marked on the layer as a video: no file holds it, so a build cannot take it from assets.
  it("notes a video fill as a video, not as a fill the table cannot write", () => {
    expect(cssOf({ fills: [{ type: "VIDEO" }] }).notes).toEqual([
      ["background", "a video fill (the Plugin API exports no file of it)"],
    ]);
  });
});
