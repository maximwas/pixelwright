import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { FONTS_CHECK_FIELD } from "@/server/tools/fonts-check/fonts-check.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const FontsCheckInputSchema = zod.strictObject({
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(FONTS_CHECK_FIELD.node)),
  file: FileInputSchema,
});

const CheckedFontSchema = zod.object({
  family: zod.string(),
  weights: zod.array(zod.string()).check(zod.describe(FONTS_CHECK_FIELD.weights)),
  google: zod.nullable(zod.boolean()).check(zod.describe(FONTS_CHECK_FIELD.google)),
  css: zod.exactOptional(zod.string()).check(zod.describe(FONTS_CHECK_FIELD.css)),
  note: zod.exactOptional(zod.string()),
});

/** 0.7.0's answer (T-101): a summary, then each family with its weights, whether Google serves it, its link, a note. */
export const FontsCheckOutputSchema = zod.object({ summary: zod.string(), fonts: zod.array(CheckedFontSchema) });

export type FontsCheckInput = zod.output<typeof FontsCheckInputSchema>;
export type FontsChecked = zod.output<typeof FontsCheckOutputSchema>;
export type CheckedFont = FontsChecked["fonts"][number];
