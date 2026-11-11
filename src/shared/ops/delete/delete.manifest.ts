import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { DELETE } from "@/shared/ops/delete/delete.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/**
 * Deletes layers by id, each on its own (T-045, P-160): a dry run runs the same checks, lists what would go and needs
 * no Allow edits (T-012); the real run is one undo step.
 */
export const deleteOp = new OpContract({
  name: OP_NAME.delete,
  input: zod.strictObject({
    nodes: zod
      .array(zod.string().check(zod.minLength(1), zod.maxLength(DELETE.idChars)))
      .check(zod.minLength(1), zod.maxLength(DELETE.maxNodes)),
    dryRun: zod.boolean(),
  }),
  output: zod.object({
    deleted: zod.array(zod.string()),
    errors: zod.array(zod.object({ id: zod.string(), message: zod.string() })),
  }),
  meta: {
    write: ({ dryRun }) => !dryRun,
    dryRun: true,
    timeoutMs: LIMITS.requestTimeoutMs,
    needsAllowEdits: ({ dryRun }) => !dryRun,
    turn: OP_TURN.write,
  },
});
