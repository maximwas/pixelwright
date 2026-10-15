import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const SelectionGetInputSchema = z.object({ file: FileSchema });

export const SelectionGetOutputSchema = OPERATION_SCHEMAS.selection.output;
