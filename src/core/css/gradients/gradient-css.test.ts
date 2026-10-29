import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { type Paint, SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format);
const geometry = new GradientGeometry();
const gradients = new GradientCss(geometry, new SolidPaint(), lengths, format);

const BOX = { width: 200, height: 100 };
const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const STOPS = [
  { position: 0, color: RED },
  { position: 1, color: BLUE },
];
const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
];

const MODEL: ReadModel = {
  model: 1,
  profile: "design",
  root: { id: "1:1", name: "Box", type: "FRAME", visible: true, x: 0, y: 0, width: 200, height: 100, childCount: 0 },
  styles: {},
  variables: { "V:brand": { name: "brand", collection: "Theme", resolvedType: "COLOR", remote: false, value: RED } },
};

function paint(
  type: string,
  gradientTransform: number[][],
  extra: Partial<Paint> = {},
): Paint {
  return { type, visible: true, gradientTransform, gradientStops: STOPS, ...extra };
}

describe("GradientCss", () => {
  it("reads a linear gradient's direction and stops on the box it fills", () => {
    expect(gradients.css(paint("GRADIENT_LINEAR", IDENTITY), BOX, MODEL)).toBe(
      "linear-gradient(90deg, #F00 0%, #00F 100%)",
    );
    expect(
      gradients.css(
        paint("GRADIENT_LINEAR", [
          [0, 1, 0],
          [-1, 0, 1],
        ]),
        BOX,
        MODEL,
      ),
    ).toBe("linear-gradient(180deg, #F00 0%, #00F 100%)");
  });

  // FX-020, B-064: Figma's matrix for CSS 30deg on a 200 x 100 box; getCSSAsync reads it as 49deg (no aspect correction).
  it("reads a 200 x 100 box at CSS 30deg as 30deg, not getCSSAsync's 49deg", () => {
    const thirty = paint("GRADIENT_LINEAR", [
      [0.535898, -0.464102, 0.464102],
      [0.928203, 0.267949, -0.098076],
    ]);

    expect(gradients.css(thirty, BOX, MODEL)).toBe("linear-gradient(30deg, #F00 0%, #00F 100%)");
  });

  it("reads the Orbit mark's gradient as on its 28 x 28 box", () => {
    const mark = paint(
      "GRADIENT_LINEAR",
      [
        [0.707099974155426, 0.707099974155426, -0.2071000039577484],
        [-0.707099974155426, 0.707099974155426, 0.5],
      ],
      {
        gradientStops: [
          { position: 0, color: { r: 0.23137255012989044, g: 0.18431372940540314, b: 0.8509804010391235, a: 1 } },
          { position: 1, color: { r: 0.545098066329956, g: 0.3607843220233917, b: 0.9647058844566345, a: 1 } },
        ],
      },
    );

    expect(gradients.css(mark, { width: 28, height: 28 }, MODEL)).toBe(
      "linear-gradient(135deg, #3B2FD9 14.64%, #8B5CF6 85.36%)",
    );
  });

  // C-084, C-085: an axis-aligned ellipse's radii and centre; a turned one is no CSS (the fills note it).
  it("reads a radial gradient's radii and centre, a conic one's start and centre, and no turned radial", () => {
    expect(gradients.css(paint("GRADIENT_RADIAL", IDENTITY), BOX, MODEL)).toBe(
      "radial-gradient(100px 50px at 50% 50%, #F00 0%, #00F 100%)",
    );
    expect(gradients.css(paint("GRADIENT_ANGULAR", IDENTITY), BOX, MODEL)).toBe(
      "conic-gradient(from 90deg at 50% 50%, #F00 0%, #00F 100%)",
    );
    expect(
      gradients.css(
        paint("GRADIENT_RADIAL", [
          [0.7, 0.7, 0],
          [-0.7, 0.7, 0.5],
        ]),
        BOX,
        MODEL,
      ),
    ).toBeNull();
  });

  it("folds a paint's opacity into its stops, and leaves a diamond (CSS has none) unread", () => {
    expect(gradients.css(paint("GRADIENT_LINEAR", IDENTITY, { opacity: 0.5 }), BOX, MODEL)).toBe(
      "linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, rgba(0, 0, 255, 0.5) 100%)",
    );
    expect(gradients.css(paint("GRADIENT_DIAMOND", IDENTITY), BOX, MODEL)).toBeNull();
  });

  // C-087, FX-047: a bound stop is its variable's token (its alpha in it); a transparent stop stays a raw colour.
  it("reads a stop bound to a variable as its token, and a transparent stop as a raw colour", () => {
    const stops = [
      { position: 0, color: RED, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "V:brand" } } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: 0 } },
    ];

    expect(gradients.css(paint("GRADIENT_LINEAR", IDENTITY, { gradientStops: stops }), BOX, MODEL)).toBe(
      "linear-gradient(90deg, var(--brand) 0%, rgba(0, 0, 0, 0) 100%)",
    );
    expect(gradients.css(paint("GRADIENT_LINEAR", IDENTITY, { gradientStops: stops, opacity: 0.5 }), BOX, MODEL)).toBe(
      "linear-gradient(90deg, color-mix(in srgb, var(--brand) 50%, transparent) 0%, rgba(0, 0, 0, 0) 100%)",
    );
  });
});
