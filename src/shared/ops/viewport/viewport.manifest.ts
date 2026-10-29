import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { ViewportOutputSchema } from "@/shared/ops/viewport/viewport.schema.ts";

/** What the user is looking at now (T-033): for "this" or "here" with nothing selected. */
export const viewportOp = new OpContract({
  name: OP_NAME.viewport,
  input: zod.strictObject({}),
  output: ViewportOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
