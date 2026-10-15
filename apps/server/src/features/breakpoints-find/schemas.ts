import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const BreakpointsInputSchema = z.object({
  node: z.string().min(1).max(200).describe("A screen's id, or a layer's on it."),
  file: FileSchema,
});
