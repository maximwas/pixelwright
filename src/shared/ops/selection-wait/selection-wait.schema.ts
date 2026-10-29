import * as zod from "zod/mini";
import { SelectionOutputSchema } from "@/shared/ops/selection/selection.schema.ts";
import { SELECTION_WAIT } from "@/shared/ops/selection-wait/selection-wait.constants.ts";

/** One round: how long it waits, and the selection (ids) the wait began from; null, the selection now. */
export const SelectionRoundInputSchema = zod.strictObject({
  timeoutMs: zod.int().check(zod.minimum(SELECTION_WAIT.shortestRoundMs), zod.maximum(SELECTION_WAIT.roundMs)),
  from: zod.nullable(zod.array(zod.string())),
});

/** Whether the user selected something else, the selection the round began from, and the selection now. */
export const SelectionRoundOutputSchema = zod.object({
  changed: zod.boolean(),
  from: zod.array(zod.string()),
  nodes: SelectionOutputSchema.shape.nodes,
});
