import * as z from "zod";
import { BoundVariablesSchema, PaintSchema } from "./snapshot-values.ts";

export const LineHeightSchema = z.looseObject({
  unit: z.string(),
  value: z.number().optional(),
});
export const LetterSpacingSchema = z.looseObject({
  unit: z.string(),
  value: z.number(),
});
export const FontNameSchema = z.object({
  family: z.string(),
  style: z.string(),
  /** Axis values of a variable font: `{wght: 450}`. */
  variationSettings: z.record(z.string(), z.number()).optional(),
});

/** A text decoration's offset or thickness: pixels, percent of the font size, or Figma's automatic one. */
const DecorationLengthSchema = z.looseObject({
  unit: z.string(),
  value: z.number().optional(),
});

export const GridTrackSchema = z.object({
  type: z.string(),
  value: z.number().optional(),
});

/** A run of text with one set of styles (getStyledTextSegments). */
export const TextSegmentSchema = z.looseObject({
  characters: z.string(),
  start: z.number(),
  end: z.number(),
  fontName: FontNameSchema,
  fontSize: z.number(),
  fontWeight: z.number(),
  fontStyle: z.string().optional(),
  textDecoration: z.string(),
  textCase: z.string(),
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
  fills: z.array(PaintSchema),
  fillStyleId: z.string(),
  textStyleId: z.string(),
  hyperlink: z
    .looseObject({
      type: z.string(),
      value: z.string(),
    })
    .nullable()
    .optional(),
  textDecorationStyle: z.string().nullable().optional(),
  textDecorationOffset: DecorationLengthSchema.nullable().optional(),
  textDecorationThickness: DecorationLengthSchema.nullable().optional(),
  textDecorationColor: z
    .looseObject({ value: z.union([z.literal("AUTO"), PaintSchema]) })
    .nullable()
    .optional(),
  listOptions: z.looseObject({ type: z.string() }).optional(),
  indentation: z.number().optional(),
  paragraphIndent: z.number().optional(),
  paragraphSpacing: z.number().optional(),
  textWrapStyle: z.string().optional(),
  openTypeFeatures: z.record(z.string(), z.boolean()).optional(),
  boundVariables: BoundVariablesSchema.optional(),
});
