import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";

export const FileMapInputSchema = zod.object({ file: FileInputSchema });

/** The plugin's map, sizes in whole px. */
export const FileMapOutputSchema = fileMapOp.output;

export type FileMapInput = zod.output<typeof FileMapInputSchema>;

export type FileMapOutput = zod.output<typeof FileMapOutputSchema>;
