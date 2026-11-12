import * as zod from "zod/mini";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** A component set, one of its variants, or an instance of one. */
export const SetOfOpInputSchema = zod.strictObject({ node: NodeIdSchema });

/** The set it is, holds or comes from. */
export const SetOfOpOutputSchema = zod.strictObject({ id: zod.string(), name: zod.string() });

export type SetOfInput = zod.output<typeof SetOfOpInputSchema>;
export type SetOfOutput = zod.output<typeof SetOfOpOutputSchema>;
