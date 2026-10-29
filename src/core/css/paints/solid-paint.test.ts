import { describe, expect, it } from "vitest";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Paint = NonNullable<ReadLayer["strokes"]>[number];

const solid = new SolidPaint(new TokenNames());
const LINE = { r: 23 / 255, g: 49 / 255, b: 38 / 255 };
const ALIAS = { color: { type: "VARIABLE_ALIAS", id: "V:1" } };
const VARIABLE = {
  name: "color/line",
  collection: "Orbit",
  resolvedType: "COLOR",
  remote: false,
  value: { ...LINE, a: 0.5 },
};

function model(fields: Partial<ReadModel> = {}): ReadModel {
  return {
    model: 1,
    profile: "design",
    root: { id: "1:1", name: "Frame", type: "FRAME", visible: true, x: 0, y: 0, width: 10, height: 10, childCount: 0 },
    styles: {},
    variables: { "V:1": VARIABLE },
    ...fields,
  };
}

function paint(fields: Partial<Paint>): Paint {
  return { type: "SOLID", color: LINE, ...fields };
}

describe("SolidPaint", () => {
  it("writes a raw colour faded by the paint's opacity", () => {
    expect(solid.css(paint({}), model())).toBe("#173126");
    expect(solid.css(paint({ opacity: 0.4 }), model())).toBe("rgba(23, 49, 38, 0.4)");
  });

  // C-1.7, B-058: a P3 file's channels are P3 values, written as P3; converting them to sRGB changes the colour.
  it("keeps a Display P3 file's colour in P3", () => {
    expect(solid.css(paint({ color: { r: 0.2314, g: 0.1843, b: 0.851 } }), model({ colorProfile: "DISPLAY_P3" }))).toBe(
      "color(display-p3 0.2314 0.1843 0.851)",
    );
  });

  // C-088: a bound colour variable is its token.
  it("writes a bound colour variable as its token, named after the variable or its WEB code syntax", () => {
    expect(solid.css(paint({ opacity: 0.5, boundVariables: ALIAS }), model())).toBe("var(--color-line)");

    const named = model({ variables: { "V:1": { ...VARIABLE, codeSyntax: { WEB: "var(--line-soft)" } } } });

    expect(solid.css(paint({ opacity: 0.5, boundVariables: ALIAS }), named)).toBe("var(--line-soft)");
  });

  // C-020, B-048, FX-046: Figma keeps the variable's alpha as the paint's opacity; only an opacity past it is a mix.
  it("writes a bound paint under the variable's own alpha as color-mix, in display-p3 in a P3 file", () => {
    expect(solid.css(paint({ opacity: 0.2, boundVariables: ALIAS }), model())).toBe(
      "color-mix(in srgb, var(--color-line) 40%, transparent)",
    );
    expect(solid.css(paint({ opacity: 0.2, boundVariables: ALIAS }), model({ colorProfile: "DISPLAY_P3" }))).toBe(
      "color-mix(in display-p3, var(--color-line) 40%, transparent)",
    );
  });

  it("writes the raw colour of a paint whose variable the read does not hold", () => {
    expect(solid.css(paint({ boundVariables: ALIAS }), model({ variables: {} }))).toBe("#173126");
  });
});
