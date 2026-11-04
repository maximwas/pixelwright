import * as zod from "zod/mini";
import { VariantsViewSchema } from "@/core/diff/diff.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { VARIANTS_READ_FIELD } from "@/server/tools/variants-read/variants-read.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.7.0's input (T-086): a set, a variant or an instance, and the file. */
export const VariantsReadInputSchema = zod.strictObject({
  node: NodeIdSchema.check(zod.describe(VARIANTS_READ_FIELD.node)),
  file: FileInputSchema,
});

export const VariantsReadOutputSchema = zod.strictObject({
  ...VariantsViewSchema.shape,
  cut: zod.exactOptional(zod.string()).check(zod.describe(VARIANTS_READ_FIELD.cut)),
});

export type VariantsReadAnswer = zod.output<typeof VariantsReadOutputSchema>;

export type VariantsReadInput = zod.output<typeof VariantsReadInputSchema>;
