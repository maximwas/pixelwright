import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { ImageInputSchema, ImageOutputSchema } from "@/shared/ops/image/image.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** An image as it was placed, held for chunk (T-055, T-194): a read, so it never needs Allow edits. */
export const imageOp = new OpContract({
  name: OP_NAME.image,
  input: ImageInputSchema,
  output: ImageOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
