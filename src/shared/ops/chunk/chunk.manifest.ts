import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { ChunkInputSchema, ChunkOutputSchema } from "@/shared/ops/chunk/chunk.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** A part of a held export (T-075): it reads the plugin's memory, not the file, so it runs at once and is not listed. */
export const chunkOp = new OpContract({
  name: OP_NAME.chunk,
  input: ChunkInputSchema,
  output: ChunkOutputSchema,
  meta: {
    write: false,
    dryRun: false,
    timeoutMs: LIMITS.requestTimeoutMs,
    needsAllowEdits: false,
    turn: OP_TURN.free,
    quiet: true,
  },
});
