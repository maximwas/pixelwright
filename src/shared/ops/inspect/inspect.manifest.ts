import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { InspectOpInputSchema, InspectOpOutputSchema } from "@/shared/ops/inspect/inspect.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** Layers as Figma has them, for inspect and measure (T-080, T-084): a read, so it never needs Allow edits (B-043). */
export const inspectOp = new OpContract({
  name: OP_NAME.inspect,
  input: InspectOpInputSchema,
  output: InspectOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
