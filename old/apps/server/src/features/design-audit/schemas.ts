import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const AuditInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer to audit (a screen, a section). Default: the one layer selected in Figma."),
  file: FileSchema,
});
