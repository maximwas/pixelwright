import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { UploadInputSchema, UploadOutputSchema } from "@/shared/ops/upload/upload.schema.ts";

/**
 * A part of a file design_apply writes from (T-131, P-030), sent before the apply that uses it: it fills the plugin's
 * memory, not the file, so it runs at once, needs no Allow edits and is not listed.
 */
export const uploadOp = new OpContract({
  name: OP_NAME.upload,
  input: UploadInputSchema,
  output: UploadOutputSchema,
  meta: {
    write: false,
    dryRun: false,
    timeoutMs: LIMITS.requestTimeoutMs,
    needsAllowEdits: false,
    turn: OP_TURN.free,
    quiet: true,
  },
});
