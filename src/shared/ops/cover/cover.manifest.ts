import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { CoverInputSchema, CoverOutputSchema } from "@/shared/ops/cover/cover.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** Where a clip is cut from (T-073, O-014): a read before the export, listed as the export it leads to. */
export const coverOp = new OpContract({
  name: OP_NAME.cover,
  input: CoverInputSchema,
  output: CoverOutputSchema,
  meta: {
    write: false,
    dryRun: false,
    timeoutMs: LIMITS.requestTimeoutMs,
    needsAllowEdits: false,
    turn: OP_TURN.read,
    quiet: true,
  },
});
