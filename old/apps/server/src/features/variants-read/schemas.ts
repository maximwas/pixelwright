import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const VariantsInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .describe("A component set's id, or one of its variants', or an instance's: its set is read."),
  file: FileSchema,
});
