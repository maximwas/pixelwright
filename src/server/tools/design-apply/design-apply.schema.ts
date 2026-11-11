import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { DESIGN_APPLY_FIELD, DESIGN_APPLY_LIMIT } from "@/server/tools/design-apply/design-apply.constants.ts";

export const DesignApplyInputSchema = zod.strictObject({
  xml: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(DESIGN_APPLY_LIMIT.xmlChars), zod.describe(DESIGN_APPLY_FIELD.xml)),
  dryRun: DryRunInputSchema,
  version: VersionInputSchema,
  file: FileInputSchema,
});

export const DesignApplyOutputSchema = zod.object({
  elements: zod.number().check(zod.describe(DESIGN_APPLY_FIELD.elements)),
  ...WRITER_OUTPUT,
});

export type DesignApplyInput = zod.output<typeof DesignApplyInputSchema>;

export type DesignApplyOutput = zod.output<typeof DesignApplyOutputSchema>;
