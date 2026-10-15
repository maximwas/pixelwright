import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const ChangesSinceInputSchema = z.object({
  cursor: z
    .number()
    .int()
    .min(0)
    .exactOptional()
    .describe("The cursor an earlier answer gave: only what changed after it. Default: all the plugin has seen."),
  file: FileSchema,
});

export const ChangesSinceOutputSchema = OPERATION_SCHEMAS.changes.output;
