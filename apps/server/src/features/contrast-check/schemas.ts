import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const ContrastInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The layer whose texts to check (a section, a screen). Default: the one layer selected in Figma."),
  file: FileSchema,
});
