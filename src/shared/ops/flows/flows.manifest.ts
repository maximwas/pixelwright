import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FlowsOpInputSchema, FlowsOpOutputSchema } from "@/shared/ops/flows/flows.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** A page's prototype (P-121): its flow starts, screens and layers with interactions, for flow_read; a read. */
export const flowsOp = new OpContract({
  name: OP_NAME.flows,
  input: FlowsOpInputSchema,
  output: FlowsOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
