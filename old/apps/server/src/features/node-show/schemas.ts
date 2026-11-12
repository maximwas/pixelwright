import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const NodeShowInputSchema = z.object({
  node: OPERATION_SCHEMAS.show.input.shape.node.describe("The layer's id, e.g. 54:243. Give node or nodes."),
  nodes: OPERATION_SCHEMAS.show.input.shape.nodes.describe("Several layers on one page, fitted in view together."),
  zoom: OPERATION_SCHEMAS.show.input.shape.zoom.describe('"fit" (default), or a zoom: 1 is 100%, 0.5 is 50%.'),
  select: OPERATION_SCHEMAS.show.input.shape.select.describe(
    "Select them too (default), or only bring them into view.",
  ),
  file: FileSchema,
});

export const NodeShowOutputSchema = OPERATION_SCHEMAS.show.output;
