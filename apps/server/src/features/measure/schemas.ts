import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const MeasureInputSchema = z.object({
  nodes: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(100)
    .exactOptional()
    .describe(
      'The layers\' ids in the order to measure, each from the one before, e.g. ["54:244", "54:268"]. Default: the layers selected in Figma.',
    ),
  painted: z
    .boolean()
    .default(false)
    .describe("Measure what is painted (centred or outside strokes, shadows, blur) instead of the layout boxes."),
  file: FileSchema,
});
