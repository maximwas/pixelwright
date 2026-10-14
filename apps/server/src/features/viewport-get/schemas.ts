import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const ViewportGetInputSchema = z.object({ file: FileSchema });

export const ViewportGetOutputSchema = OPERATION_SCHEMAS.viewport.output;
