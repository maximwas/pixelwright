import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { NearbyOpInputSchema, NearbyOpOutputSchema } from "@/shared/ops/nearby/nearby.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** The designer's notes around the screen holding a layer (T-058): a read, it changes nothing. */
export const nearbyOp = new OpContract({
  name: OP_NAME.nearby,
  input: NearbyOpInputSchema,
  output: NearbyOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
