import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { UsageOpInputSchema, UsageOpOutputSchema } from "@/shared/ops/usage/usage.schema.ts";

/** The layers that use a style or variable (T-106, P-126): a read within its own budget (D-48). */
export const usageOp = new OpContract({
  name: OP_NAME.usage,
  input: UsageOpInputSchema,
  output: UsageOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
