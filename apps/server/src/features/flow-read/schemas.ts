import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const FlowReadInputSchema = z.object({
  page: OPERATION_SCHEMAS.flows.input.shape.page.describe("The page's id. Default: the current page."),
  file: FileSchema,
});

export const FlowReadOutputSchema = OPERATION_SCHEMAS.flows.output;
