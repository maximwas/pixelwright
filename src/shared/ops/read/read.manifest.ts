import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { ReadOpInputSchema, ReadOpOutputSchema } from "@/shared/ops/read/read.schema.ts";

/** Layers as the read model (A§7.1, A§9.4): the one op design_read and the reads after it share; it changes nothing. */
export const readOp = new OpContract({
  name: OP_NAME.read,
  input: ReadOpInputSchema,
  output: ReadOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
