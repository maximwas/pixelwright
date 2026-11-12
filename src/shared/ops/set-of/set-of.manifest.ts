import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { SetOfOpInputSchema, SetOfOpOutputSchema } from "@/shared/ops/set-of/set-of.schema.ts";

/** The component set a layer is, holds a variant of, or is an instance of (P-116), for variants_read; a read. */
export const setOfOp = new OpContract({
  name: OP_NAME.setOf,
  input: SetOfOpInputSchema,
  output: SetOfOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
