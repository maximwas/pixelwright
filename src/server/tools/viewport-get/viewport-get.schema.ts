import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { viewportOp } from "@/shared/ops/viewport/viewport.manifest.ts";

export const ViewportGetInputSchema = zod.strictObject({ file: FileInputSchema });

export const ViewportGetOutputSchema = viewportOp.output;

export type ViewportGetInput = zod.output<typeof ViewportGetInputSchema>;

export type ViewportGetOutput = zod.output<typeof ViewportGetOutputSchema>;
