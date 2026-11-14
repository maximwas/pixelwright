import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { BindOpInputSchema, BindOpOutputSchema } from "@/shared/ops/bind/bind.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** The raw values tokens_bind may bind (T-167, P-164): a read the server matches, so Allow edits may be off. */
export const bindOp = new OpContract({
  name: OP_NAME.bind,
  input: BindOpInputSchema,
  output: BindOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
