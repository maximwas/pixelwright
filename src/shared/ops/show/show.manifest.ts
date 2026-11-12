import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { ShowInputSchema, ShowOutputSchema } from "@/shared/ops/show/show.schema.ts";

/**
 * Layers into view on their one page, selected unless told not to (T-032, P-112). A read by the T-032 ruling: it
 * changes the user's view and selection, never the file, so it needs no Allow edits and waits for no write.
 */
export const showOp = new OpContract({
  name: OP_NAME.show,
  input: ShowInputSchema,
  output: ShowOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
