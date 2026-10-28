import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { SelectionOutputSchema } from "@/shared/ops/selection/selection.schema.ts";

export const SelectionGetInputSchema = zod.strictObject({ file: FileInputSchema });

export const SelectionGetOutputSchema = SelectionOutputSchema;

export type SelectionGetInput = zod.output<typeof SelectionGetInputSchema>;

export type SelectionGetOutput = zod.output<typeof SelectionGetOutputSchema>;
