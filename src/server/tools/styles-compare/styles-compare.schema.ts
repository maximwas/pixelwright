import * as zod from "zod/mini";
import { StylesComparedSchema } from "@/core/checks/build-styles/build-styles.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import {
  STYLES_COMPARE,
  STYLES_COMPARE_FIELD,
  STYLES_COMPARE_TEXT,
} from "@/server/tools/styles-compare/styles-compare.constants.ts";

const ComputedStylesSchema = zod
  .record(
    zod.string().check(zod.minLength(1), zod.maxLength(STYLES_COMPARE.keyChars)),
    zod.string().check(zod.maxLength(STYLES_COMPARE.valueChars)),
  )
  .check(
    zod.refine((css) => Object.keys(css).length <= STYLES_COMPARE.propertiesMax, {
      error: STYLES_COMPARE_TEXT.tooMany,
    }),
    zod.describe(STYLES_COMPARE_FIELD.css),
  );

const PairSchema = zod.object({
  node: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(STYLES_COMPARE.nodeChars), zod.describe(STYLES_COMPARE_FIELD.node)),
  css: ComputedStylesSchema,
  label: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(STYLES_COMPARE.labelChars)))
    .check(zod.describe(STYLES_COMPARE_FIELD.label)),
});

/** 0.7.0's input (T-090): the pairs, the tolerance for sizes and places, the file. */
export const StylesCompareInputSchema = zod.strictObject({
  pairs: zod
    .array(PairSchema)
    .check(zod.minLength(1), zod.maxLength(STYLES_COMPARE.pairsMax), zod.describe(STYLES_COMPARE_FIELD.pairs)),
  tolerance: zod
    ._default(zod.number().check(zod.minimum(0), zod.maximum(STYLES_COMPARE.toleranceMax)), STYLES_COMPARE.tolerance)
    .check(zod.describe(STYLES_COMPARE_FIELD.tolerance)),
  file: FileInputSchema,
});

export const StylesCompareOutputSchema = StylesComparedSchema;

export type StylesCompareInput = zod.output<typeof StylesCompareInputSchema>;
