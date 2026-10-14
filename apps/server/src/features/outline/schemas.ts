import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const OutlineInputSchema = z.object({
  node: OPERATION_SCHEMAS.outline.input.shape.node.describe(
    "The layer or page id, or 0:0 for the list of pages. Default: the current page.",
  ),
  depth: OPERATION_SCHEMAS.outline.input.shape.depth.describe("How many levels below the node to list (1 to 10)."),
  file: FileSchema,
});

export const OutlineOutputSchema = z.object({
  xml: z.string(),
  nodes: z.number().describe("How many layers the XML lists."),
});
