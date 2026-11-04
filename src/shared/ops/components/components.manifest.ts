import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { ComponentsOpInputSchema, ComponentsOpOutputSchema } from "@/shared/ops/components/components.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** The file's components or the ones a layer uses (T-190), their Dev Mode links on request (T-192): a read. */
export const componentsOp = new OpContract({
  name: OP_NAME.components,
  input: ComponentsOpInputSchema,
  output: ComponentsOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
