import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { FileSchema } from "../../plugin/file-schema.ts";

export const NodesFindInputSchema = OPERATION_SCHEMAS.find.input.extend({ file: FileSchema });

export const NodesFindOutputSchema = OPERATION_SCHEMAS.find.output;
