import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import {
  SelectionRoundInputSchema,
  SelectionRoundOutputSchema,
} from "@/shared/ops/selection-wait/selection-wait.schema.ts";

/**
 * One round of waiting for the user to select something else (T-031, P-111). Free of the turns: a wait for the user
 * must never hold a write back. The usual wait covers a round, which answers by its own time, 25 s at most.
 */
export const selectionWaitOp = new OpContract({
  name: OP_NAME.selectionWait,
  input: SelectionRoundInputSchema,
  output: SelectionRoundOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.free },
});
