import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { InspectFills } from "@/core/inspect/inspect-fills.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { InspectedLayer, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const solid = new SolidPaint(names);
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const inspectFills = new InspectFills(paints, solid, names);

const DARK = { r: 0.098, g: 0.102, b: 0.137 };
const WHITE = { r: 1, g: 1, b: 1 };
const RED = { r: 1, g: 0, b: 0 };

/** A layer as the inspect op gives it: a 100 x 40 box at the page's corner, with no parent. */
function layer(fields: Partial<InspectedLayer>): InspectedLayer {
  const box = { x: 0, y: 0, width: 100, height: 40 };

  return {
    id: "2:1",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    ...box,
    childCount: 0,
    parent: null,
    box,
    paintedBox: null,
    parentBox: null,
    parentPadding: null,
    ...fields,
  };
}

function raw(layers: InspectedLayer[], fields: Partial<InspectRaw> = {}): InspectRaw {
  return { origin: null, layers, missing: [], styles: {}, variables: {}, ...fields };
}

describe("inspect fills", () => {
  const fills = (fields: Partial<InspectedLayer>, model: Partial<InspectRaw> = {}) =>
    inspectFills.read(layer(fields), raw([], model)).fills;

  it("gives the fill as its CSS value with the style it comes from", () => {
    expect(
      fills(
        { fills: [{ type: "SOLID", color: WHITE }], fillStyleId: "S:w" },
        {
          styles: { "S:w": { name: "White", type: "PAINT", remote: true, paints: [{ type: "SOLID", color: WHITE }] } },
        },
      ),
    ).toEqual({ css: "#FFF", style: { name: "White", token: "--White" }, paints: [{ type: "SOLID" }] });
  });

  it("names the variables a fill is bound to, with their values", () => {
    expect(
      fills(
        { fills: [{ type: "SOLID", color: WHITE, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "V:1" } } }] },
        {
          variables: {
            "V:1": { name: "color/bg", collection: "Colors", resolvedType: "COLOR", remote: false, value: DARK },
          },
        },
      ),
    ).toEqual({ css: "var(--color-bg)", tokens: { "--color-bg": "#191A23" }, paints: [{ type: "SOLID" }] });
  });

  it("names the variables a stroke colour is bound to, as a fill's", () => {
    const strokes = inspectFills.read(
      layer({
        strokes: [{ type: "SOLID", color: WHITE, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "V:1" } } }],
      }),
      raw([], {
        variables: {
          "V:1": { name: "color/line", collection: "Colors", resolvedType: "COLOR", remote: false, value: DARK },
        },
      }),
    ).strokes;

    expect(strokes?.tokens).toEqual({ "--color-line": "#191A23" });
  });

  // B-002: each fill's blend mode, top first.
  it("lists each paint top first, with a blend mode other than normal and its CSS name", () => {
    expect(
      fills({
        fills: [
          { type: "SOLID", color: WHITE, blendMode: "NORMAL" },
          { type: "SOLID", color: RED, blendMode: "MULTIPLY" },
        ],
      })?.paints,
    ).toEqual([{ type: "SOLID", blendMode: "MULTIPLY", mixBlendMode: "multiply" }, { type: "SOLID" }]);
  });

  // D-23: every fill type, a video too, though CSS cannot hold it.
  it("names a video fill and says CSS cannot hold it", () => {
    expect(fills({ fills: [{ type: "VIDEO", visible: true }] })).toEqual({
      css: "a video fill (the Plugin API exports no file of it)",
      paints: [{ type: "VIDEO" }],
    });
  });

  it("writes a gradient as core's CSS for it", () => {
    expect(
      fills({
        fills: [
          {
            type: "GRADIENT_LINEAR",
            gradientStops: [
              { position: 0, color: { ...WHITE, a: 1 } },
              { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
            ],
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
          },
        ],
      })?.css,
    ).toMatch(/^linear-gradient\(/);
  });
});

// O-026: a bound length has one token name, the one design_read's var() takes.
describe("inspect of bound lengths", () => {
  it("gives each bound field's token and value, the token design_read writes", () => {
    const variables = {
      "V:2": { name: "space/24", collection: "Spacing", resolvedType: "FLOAT", remote: false, value: 24 },
      "V:3": {
        name: "gap m",
        collection: "Spacing",
        resolvedType: "FLOAT",
        remote: false,
        value: 16,
        codeSyntax: { WEB: "var(--gap-m)" },
      },
    };
    const card = layer({
      paddingTop: 24,
      itemSpacing: 16,
      boundVariables: {
        paddingTop: { type: "VARIABLE_ALIAS", id: "V:2" },
        itemSpacing: { type: "VARIABLE_ALIAS", id: "V:3" },
      },
    });
    const read = inspectFills.read(card, raw([], { variables }));

    expect(read?.bound).toEqual({
      paddingTop: { token: "--space-24", value: 24 },
      itemSpacing: { token: "--gap-m", value: 16 },
    });
    expect(
      lengths.bound(card, "paddingTop", 24, { model: 1, profile: "inspect", root: card, styles: {}, variables }),
    ).toBe(`var(${read?.bound?.paddingTop?.token})`);
  });
});

// T-083: a Display P3 file's colours stay in its space.
describe("inspect of a Display P3 file", () => {
  it("writes fills and strokes in the file's colours, as design_read does", () => {
    const badge = inspectFills.read(
      layer({
        fills: [{ type: "SOLID", visible: true, color: RED }],
        strokes: [{ type: "SOLID", visible: true, color: RED }],
        strokeWeight: 1,
      }),
      raw([], { colorProfile: "DISPLAY_P3" }),
    );

    expect(badge?.fills?.css).toBe("color(display-p3 1 0 0)");
    expect(badge?.strokes?.colors).toEqual(["color(display-p3 1 0 0)"]);
  });
});
