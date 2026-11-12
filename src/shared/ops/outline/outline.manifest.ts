import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { OutlineOpInputSchema, OutlineOpOutputSchema } from "@/shared/ops/outline/outline.schema.ts";

/** The layer tree under a layer or a page, or the document's pages (T-044): a read, it changes nothing. */
export const outlineOp = new OpContract({
  name: OP_NAME.outline,
  input: OutlineOpInputSchema,
  output: OutlineOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
