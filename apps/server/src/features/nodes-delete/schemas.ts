import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../schemas/tools.ts";

export const NodesDeleteInputSchema = z.object({
  nodes: OPERATION_SCHEMAS.delete.input.shape.nodes.describe('The layers\' ids, e.g. ["54:243"].'),
  file: FileSchema,
});

export const NodesDeleteOutputSchema = OPERATION_SCHEMAS.delete.output;
