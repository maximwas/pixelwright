import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FileMapOpInputSchema, FileMapOpOutputSchema } from "@/shared/ops/file-map/file-map.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** Every page with its top layers (T-034), or the pages only: a read, it changes nothing. */
export const fileMapOp = new OpContract({
  name: OP_NAME.fileMap,
  input: FileMapOpInputSchema,
  output: FileMapOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
