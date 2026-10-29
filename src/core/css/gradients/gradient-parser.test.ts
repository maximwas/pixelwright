import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format);
const geometry = new GradientGeometry();
const gradients = new GradientCss(geometry, new SolidPaint(), lengths, format);
const parser = new GradientParser(new CssSplit(), new CssVar(new CssSplit()), geometry);

const MODEL: ReadModel = {
  model: 1,
  profile: "design",
  root: { id: "1:1", name: "Box", type: "FRAME", visible: true, x: 0, y: 0, width: 200, height: 100, childCount: 0 },
  styles: {},
  variables: {},
};

/** A gradient written to Figma's transform at the box's size, then read back as CSS. */
function roundTrip(css: string, box = { width: 200, height: 100 }): string | null {
  const spec = parser.parse(css);

  if (spec === null) {
    throw new Error(`not a gradient: ${css}`);
  }

  const paint = {
    type: `GRADIENT_${spec.type}`,
    gradientTransform: geometry.transform(spec, box).map((row) => [...row]),
    gradientStops: spec.stops.map(({ position, color }) => ({ position, color: color ?? { r: 0, g: 0, b: 0, a: 1 } })),
  };

  return gradients.css(paint, box, MODEL);
}

describe("GradientParser", () => {
  // C-086: written to Figma's transform and read back unchanged, on a wide box and a tall one.
  it.each([
    "linear-gradient(90deg, #F00 0%, #00F 100%)",
    "linear-gradient(135deg, #F00 10%, #0F0 50%, #00F 90%)",
    "linear-gradient(30deg, rgba(255, 0, 0, 0.5) 0%, #00F 100%)",
    "radial-gradient(120px 40px at 30% 60%, #F00 0%, #00F 100%)",
    "conic-gradient(from 45deg at 50% 50%, #F00 0%, #00F 100%)",
  ])("writes %s so it reads back as written", (css) => {
    expect(roundTrip(css)).toBe(css);
    expect(roundTrip(css, { width: 64, height: 300 })).toBe(css);
  });

  it("takes the side keywords, spreads stops without places evenly, and reads tokens and transparent", () => {
    expect(parser.parse("linear-gradient(to bottom, #F00, #0F0, #00F)")).toMatchObject({
      type: "LINEAR",
      angle: 180,
      stops: [{ position: 0 }, { position: 0.5 }, { position: 1 }],
    });
    expect(parser.parse("linear-gradient(90deg, var(--brand) 0%, transparent 100%)")?.stops).toMatchObject([
      { position: 0, token: "--brand", color: null },
      { position: 1, color: { a: 0 } },
    ]);
  });

  // KL §8: the library tried first failed on exactly these.
  it("parses radial sizes, color-mix and Display P3 stops", () => {
    expect(parser.parse("radial-gradient(circle 40px at left top, #F00, #00F)")).toMatchObject({
      type: "RADIAL",
      center: { x: { value: 0, unit: "%" }, y: { value: 0, unit: "%" } },
      radii: { x: { value: 40, unit: "px" }, y: { value: 40, unit: "px" } },
    });
    expect(parser.parse("radial-gradient(50% 25% at 30px 60%, #F00, #00F)")).toMatchObject({
      center: { x: { value: 30, unit: "px" }, y: { value: 60, unit: "%" } },
      radii: { x: { value: 50, unit: "%" }, y: { value: 25, unit: "%" } },
    });
    expect(
      parser.parse(
        "linear-gradient(90deg, color-mix(in srgb, var(--brand) 50%, transparent) 0%, color-mix(in srgb, #F00 50%, transparent) 50%, color(display-p3 1 0 0) 100%)",
      )?.stops,
    ).toMatchObject([
      { position: 0, token: "--brand", opacity: 0.5, color: null },
      { position: 0.5, color: { r: 1, g: 0, b: 0, a: 0.5 } },
      { position: 1, color: { r: 1, g: 0, b: 0, a: 1, space: "display-p3" } },
    ]);
  });

  it("is null for what is no gradient it can write", () => {
    expect(parser.parse("#F00")).toBeNull();
    expect(parser.parse("repeating-linear-gradient(90deg, #F00 0%, #00F 10%)")).toBeNull();
    expect(parser.parse("radial-gradient(closest-side at 50% 50%, #F00, #00F)")).toBeNull();
    expect(parser.parse("linear-gradient(90deg, #F00 0%)")).toBeNull();
  });
});
