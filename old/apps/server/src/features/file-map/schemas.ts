import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const FileMapInputSchema = z.object({ file: FileSchema });

export const FileMapOutputSchema = OPERATION_SCHEMAS.file_map.output;
