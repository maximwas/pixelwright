import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const A11yReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("The screen or section to read. Default: the one layer selected in Figma."),
  file: FileSchema,
});
