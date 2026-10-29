import * as zod from "zod/mini";
import { BoundVariablesSchema, PaintSchema } from "@/shared/read-model/layer-values.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

export const LineHeightSchema = zod.looseObject({ unit: zod.string(), value: zod.exactOptional(zod.number()) });

export const LetterSpacingSchema = zod.looseObject({ unit: zod.string(), value: zod.number() });

export const FontNameSchema = zod.strictObject({
  family: zod.string(),
  style: zod.string(),
  /** Axis values of a variable font: `{wght: 450}`. */
  variationSettings: zod.exactOptional(zod.record(zod.string(), zod.number())),
});

/** A text decoration's offset or thickness: pixels, percent of the font size, or Figma's automatic one. */
const DecorationLengthSchema = zod.looseObject({ unit: zod.string(), value: zod.exactOptional(zod.number()) });

export const GridTrackSchema = zod.strictObject({ type: zod.string(), value: zod.exactOptional(zod.number()) });

/** What a text on a path has besides its text: the path it runs along, and where on it the text starts. */
export const TextPathSchema = zod.strictObject({
  vectorPaths: zod.array(zod.looseObject({ windingRule: zod.string(), data: zod.string() })),
  textPathStartData: zod.strictObject({ segment: zod.number(), position: zod.number() }),
});

/** A run of text with one set of styles (getStyledTextSegments). */
export const TextSegmentSchema = zod.looseObject({
  characters: zod.string(),
  start: zod.number(),
  end: zod.number(),
  fontName: FontNameSchema,
  fontSize: zod.number(),
  fontWeight: zod.number(),
  fontStyle: zod.exactOptional(zod.string()),
  textDecoration: zod.string(),
  textCase: zod.string(),
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
  fills: zod.array(PaintSchema),
  fillStyleId: zod.string(),
  textStyleId: zod.string(),
  hyperlink: zod.exactOptional(zod.nullable(zod.looseObject({ type: zod.string(), value: zod.string() }))),
  textDecorationStyle: zod.exactOptional(zod.nullable(zod.string())),
  textDecorationOffset: zod.exactOptional(zod.nullable(DecorationLengthSchema)),
  textDecorationThickness: zod.exactOptional(zod.nullable(DecorationLengthSchema)),
  textDecorationColor: zod.exactOptional(
    zod.nullable(zod.looseObject({ value: zod.union([zod.literal(READ_VALUE.autoColor), PaintSchema]) })),
  ),
  listOptions: zod.exactOptional(zod.looseObject({ type: zod.string() })),
  indentation: zod.exactOptional(zod.number()),
  paragraphIndent: zod.exactOptional(zod.number()),
  paragraphSpacing: zod.exactOptional(zod.number()),
  textWrapStyle: zod.exactOptional(zod.string()),
  openTypeFeatures: zod.exactOptional(zod.record(zod.string(), zod.boolean())),
  boundVariables: zod.exactOptional(BoundVariablesSchema),
});
