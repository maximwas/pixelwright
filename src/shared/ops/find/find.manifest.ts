import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FindOpInputSchema, FindOpOutputSchema } from "@/shared/ops/find/find.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** Layers inside one layer or page (T-040): a read, it changes nothing; "file" is resolved on the server (T-041). */
export const findOp = new OpContract({
  name: OP_NAME.find,
  input: FindOpInputSchema,
  output: FindOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
