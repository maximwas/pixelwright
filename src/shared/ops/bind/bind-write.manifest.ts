import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { BindPlanSchema } from "@/shared/ops/bind/bind.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/**
 * tokens_bind's plan written in Figma (T-167, P-164): each planned use bound to its token where it is, each rebind
 * made, a library's variable imported by its key; what Figma refuses is that layer's failure, with its reason, while
 * the rest is bound, and the whole call is one undo step. It has no dry run: tokens_bind's is core's plan over the
 * bind scan, which needs no Allow edits (toolDryRun: the refusal names it). A write runs alone; the timeout is the longest an op may ask for, since a plan
 * holds the uses of up to the scan's 2,000 layers, with fonts to load and library variables to import.
 */
export const bindWriteOp = new OpContract({
  name: OP_NAME.bindWrite,
  input: BindPlanSchema,
  output: zod.object({ failed: zod.array(zod.strictObject({ id: zod.string(), message: zod.string() })) }),
  meta: {
    write: true,
    dryRun: false,
    timeoutMs: LIMITS.requestMaxTimeoutMs,
    needsAllowEdits: true,
    turn: OP_TURN.write,
    toolDryRun: true,
  },
});
