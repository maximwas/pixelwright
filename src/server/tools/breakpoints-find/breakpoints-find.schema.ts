import * as zod from "zod/mini";
import { BreakpointsViewSchema } from "@/core/diff/diff.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { BREAKPOINTS_FIND_FIELD } from "@/server/tools/breakpoints-find/breakpoints-find.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.7.0's input (T-087): a screen or a layer on one, and the file. */
export const BreakpointsFindInputSchema = zod.strictObject({
  node: NodeIdSchema.check(zod.describe(BREAKPOINTS_FIND_FIELD.node)),
  file: FileInputSchema,
});

export const BreakpointsFindOutputSchema = BreakpointsViewSchema;

export type BreakpointsFindInput = zod.output<typeof BreakpointsFindInputSchema>;
