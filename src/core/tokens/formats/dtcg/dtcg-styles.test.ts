import { describe, expect, it } from "vitest";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { DtcgPaths } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DtcgReferences } from "@/core/tokens/formats/dtcg/dtcg-references.ts";
import { DtcgStyles } from "@/core/tokens/formats/dtcg/dtcg-styles.ts";
import { DtcgTypes } from "@/core/tokens/formats/dtcg/dtcg-types.ts";
import { DtcgValues } from "@/core/tokens/formats/dtcg/dtcg-values.ts";
import { NumberUnits } from "@/core/tokens/model/number-units.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

const units = new NumberUnits();
const paths = new DtcgPaths();
const values = new DtcgValues(new NumberFormat(), units, new DtcgReferences(new DtcgTypes(units), paths));
const writer = new DtcgStyles(paths, values, new FontWeight());

const rgb = (
  red: number,
  green: number,
  blue: number,
  alpha = 1,
) => ({
  r: red / 255,
  g: green / 255,
  b: blue / 255,
  a: alpha,
});

const style = (fields: Record<string, unknown> & { id: string; name: string; type: string }) =>
  ({ remote: false, ...fields }) as RawTokens["styles"][number];

const STYLES = [
  style({
    id: "S:primary",
    name: "Brand/Primary",
    type: "PAINT",
    paints: [{ type: "SOLID", color: rgb(59, 47, 217) }],
  }),
  style({
    id: "S:gradient",
    name: "Hero gradient",
    type: "PAINT",
    paints: [
      {
        type: "GRADIENT_LINEAR",
        gradientStops: [
          { position: 0, color: rgb(59, 47, 217) },
          { position: 1, color: rgb(139, 92, 246, 0.5) },
        ],
      },
    ],
  }),
  style({
    id: "S:photo",
    name: "Photo",
    type: "PAINT",
    paints: [{ type: "IMAGE", imageHash: "abc", scaleMode: "FILL" }],
  }),
  style({
    id: "S:h3",
    name: "Heading/H3",
    type: "TEXT",
    fontName: { family: "Space Grotesk", style: "Medium" },
    fontSize: 24,
    lineHeight: { unit: "PIXELS", value: 30 },
    letterSpacing: { unit: "PERCENT", value: -1 },
    textCase: "UPPER",
  }),
  style({
    id: "S:body",
    name: "Body",
    type: "TEXT",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
  }),
  style({
    id: "S:card",
    name: "Shadow/Card",
    type: "EFFECT",
    effects: [
      {
        type: "DROP_SHADOW",
        color: { r: 0.078, g: 0.086, b: 0.122, a: 0.12 },
        offset: { x: 0, y: 12 },
        radius: 32,
        spread: -8,
      },
    ],
  }),
  style({
    id: "S:well",
    name: "Shadow/Well",
    type: "EFFECT",
    effects: [
      { type: "INNER_SHADOW", color: rgb(0, 0, 0, 0.25), offset: { x: 0, y: 2 }, radius: 4, spread: 0 },
      { type: "DROP_SHADOW", color: rgb(0, 0, 0, 0.1), offset: { x: 0, y: 1 }, radius: 2, spread: 0 },
    ],
  }),
  style({ id: "S:glass", name: "Glass", type: "EFFECT", effects: [{ type: "LAYER_BLUR", radius: 8 }] }),
];

const BRAND = { colorSpace: "srgb", components: [0.2314, 0.1843, 0.851], hex: "#3B2FD9" };

describe("DTCG styles", () => {
  it("writes paint, text and effect styles as color, gradient, typography and shadow tokens, a stop's alpha kept (K-017)", () => {
    const tree = writer.tree(STYLES, COLOR_SPACE.srgb).tree as Record<string, Record<string, unknown>>;

    expect(tree.Brand?.Primary).toEqual({ $type: "color", $value: BRAND });
    expect(tree["Hero gradient"]).toEqual({
      $type: "gradient",
      $value: [
        { color: BRAND, position: 0 },
        {
          color: { colorSpace: "srgb", components: [0.5451, 0.3608, 0.9647], alpha: 0.5, hex: "#8B5CF6" },
          position: 1,
        },
      ],
    });
    expect(tree.Heading?.H3).toEqual({
      $type: "typography",
      $value: {
        fontFamily: "Space Grotesk",
        fontSize: { value: 24, unit: "px" },
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: { value: -0.24, unit: "px" },
      },
    });
    expect(tree.Shadow?.Card).toEqual({
      $type: "shadow",
      $value: {
        color: { colorSpace: "srgb", components: [0.078, 0.086, 0.122], alpha: 0.12, hex: "#14161F" },
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 12, unit: "px" },
        blur: { value: 32, unit: "px" },
        spread: { value: -8, unit: "px" },
      },
    });
    expect((tree.Shadow?.Well as { $value: unknown[] } | undefined)?.$value[0]).toMatchObject({ inset: true });
  });

  it("names the styles DTCG has no type for, an Auto line height, and the weight it guessed (K-017, K-074)", () => {
    const text = writer.tree(STYLES, COLOR_SPACE.srgb).notes.join("\n");

    expect(text).toMatch(/Photo \(paint\), Glass \(effect\): no DTCG type/);
    expect(text).toMatch(/Body: Auto line height, written as 1\.2/);
    expect(text).toMatch(/Heading\/H3, Body: fontWeight is guessed from the font style's name/);
    expect(text).toMatch(/Hero gradient \(gradient angle\), Heading\/H3 \(text-transform\): DTCG has no field/);
  });
});
