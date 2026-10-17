import { describe, expect, it } from "vitest";
import { gradientCss, gradientOf, gradientTransformOf, type SnapshotPaint, tokenModel } from "../src/index.ts";

const BOX = {
  width: 200,
  height: 100,
};

const stops = [
  {
    position: 0,
    color: {
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    },
  },
  {
    position: 1,
    color: {
      r: 0,
      g: 0,
      b: 1,
      a: 1,
    },
  },
];

const paint = (type: string, gradientTransform: number[][], extra: Partial<SnapshotPaint> = {}): SnapshotPaint =>
  ({
    type,
    visible: true,
    gradientTransform,
    gradientStops: stops,
    ...extra,
  }) as SnapshotPaint;

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
];

/** A gradient written to Figma's transform at the box's size, then read back as CSS. */
const roundTrip = (css: string, box = BOX) => {
  const spec = gradientOf(css);

  if (spec === null) {
    throw new Error(`not a gradient: ${css}`);
  }

  return gradientCss(
    paint(`GRADIENT_${spec.type}`, gradientTransformOf(spec, box.width, box.height), {
      gradientStops: spec.stops.map(({ position, color }) => ({
        position,
        color: color ?? {
          r: 0,
          g: 0,
          b: 0,
          a: 1,
        },
      })),
    }),
    box,
  );
};

describe("gradients: Figma's paints as CSS", () => {
  it("reads a linear gradient's direction and stops on the box it fills", () => {
    expect(gradientCss(paint("GRADIENT_LINEAR", IDENTITY), BOX)).toBe("linear-gradient(90deg, #F00 0%, #00F 100%)");
    expect(
      gradientCss(
        paint("GRADIENT_LINEAR", [
          [0, 1, 0],
          [-1, 0, 1],
        ]),
        BOX,
      ),
    ).toBe("linear-gradient(180deg, #F00 0%, #00F 100%)");
  });

  it("reads a gradient as Figma's own CSS does (the Orbit mark's, from getCSSAsync)", () => {
    const mark = paint("GRADIENT_LINEAR", [
      [0.707099974155426, 0.707099974155426, -0.2071000039577484],
      [-0.707099974155426, 0.707099974155426, 0.5],
    ]);

    expect(
      gradientCss(
        {
          ...mark,
          gradientStops: [
            {
              position: 0,
              color: {
                r: 0.23137255012989044,
                g: 0.18431372940540314,
                b: 0.8509804010391235,
                a: 1,
              },
            },
            {
              position: 1,
              color: {
                r: 0.545098066329956,
                g: 0.3607843220233917,
                b: 0.9647058844566345,
                a: 1,
              },
            },
          ],
        },
        {
          width: 28,
          height: 28,
        },
      ),
    ).toBe("linear-gradient(135deg, #3B2FD9 14.64%, #8B5CF6 85.36%)");
  });

  it("reads a radial gradient's centre and radii, and an angular one's start and centre", () => {
    expect(gradientCss(paint("GRADIENT_RADIAL", IDENTITY), BOX)).toBe(
      "radial-gradient(100px 50px at 50% 50%, #F00 0%, #00F 100%)",
    );
    expect(gradientCss(paint("GRADIENT_ANGULAR", IDENTITY), BOX)).toBe(
      "conic-gradient(from 90deg at 50% 50%, #F00 0%, #00F 100%)",
    );
  });

  it("folds a paint's opacity into its stops, and leaves a diamond (CSS has none) unread", () => {
    expect(gradientCss(paint("GRADIENT_LINEAR", IDENTITY, { opacity: 0.5 }), BOX)).toBe(
      "linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, rgba(0, 0, 255, 0.5) 100%)",
    );
    expect(gradientCss(paint("GRADIENT_DIAMOND", IDENTITY), BOX)).toBeNull();
  });
});

describe("gradients: CSS written back to Figma", () => {
  it("writes linear, radial and conic gradients so they read back as they were written, on any box", () => {
    for (const css of [
      "linear-gradient(90deg, #F00 0%, #00F 100%)",
      "linear-gradient(135deg, #F00 10%, #0F0 50%, #00F 90%)",
      "linear-gradient(30deg, rgba(255, 0, 0, 0.5) 0%, #00F 100%)",
      "radial-gradient(120px 40px at 30% 60%, #F00 0%, #00F 100%)",
      "conic-gradient(from 45deg at 50% 50%, #F00 0%, #00F 100%)",
    ]) {
      expect(roundTrip(css)).toBe(css);
      expect(
        roundTrip(css, {
          width: 64,
          height: 300,
        }),
      ).toBe(css);
    }
  });

  it("takes the side keywords, stops without places spread evenly, and tokens in stops", () => {
    expect(gradientOf("linear-gradient(to bottom, #F00, #0F0, #00F)")).toMatchObject({
      type: "LINEAR",
      angle: 180,
      stops: [{ position: 0 }, { position: 0.5 }, { position: 1 }],
    });
    expect(gradientOf("linear-gradient(90deg, var(--brand) 0%, transparent 100%)")?.stops).toMatchObject([
      {
        position: 0,
        token: "--brand",
      },
      {
        position: 1,
        color: {
          a: 0,
        },
      },
    ]);
  });

  it("is null for what is not a gradient it can write", () => {
    expect(gradientOf("#F00")).toBeNull();
    expect(gradientOf("repeating-linear-gradient(90deg, #F00 0%, #00F 10%)")).toBeNull();
  });
});

describe("gradients: paint styles", () => {
  it("writes a gradient style no read layer uses as on a square, the shape Figma keeps it in", () => {
    const model = tokenModel({
      collections: [],
      variables: [],
      external: {},
      styles: [
        {
          id: "S:glow",
          name: "Glow",
          type: "PAINT",
          remote: false,
          paints: [paint("GRADIENT_LINEAR", IDENTITY)],
        },
      ],
    });

    expect(model.styles.paint).toEqual([
      {
        name: "Glow",
        token: "--Glow",
        value: "linear-gradient(90deg, #F00 0%, #00F 100%)",
      },
    ]);
    expect(model.notes).toEqual([]);
  });
});
