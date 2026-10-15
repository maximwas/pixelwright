import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const SelectionWaitInputSchema = z.object({
  timeout: z
    .number()
    .min(1)
    .max(300)
    .default(60)
    .describe("Seconds to wait for the user to select something: 60 by default, 300 at most."),
  file: FileSchema,
});

export const SelectionWaitOutputSchema = z.object({
  changed: z.boolean().describe("Whether the user selected something else before the time ran out."),
  nodes: OPERATION_SCHEMAS.selection.output.shape.nodes.describe("The selection now."),
});
