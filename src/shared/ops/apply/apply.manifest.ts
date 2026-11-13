import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { APPLY } from "@/shared/ops/apply/apply.constants.ts";
import {
  ApplyChangeSchema,
  ApplyCreatedSchema,
  ApplyErrorSchema,
  ApplyPropertySchema,
} from "@/shared/ops/apply/apply.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/**
 * design_apply's changes written in Figma, each element on its own, the whole call one undo step (T-120, T-121); a dry
 * run runs the same checks, lists what it would make and change and needs no Allow edits (T-012). The timeout is the
 * longest an op may ask for: a big call makes thousands of layers.
 */
export const applyOp = new OpContract({
  name: OP_NAME.apply,
  input: zod.strictObject({
    /** In the XML's order: a parent before its children. */
    changes: zod.array(ApplyChangeSchema).check(zod.maxLength(APPLY.maxChanges)),
    /** Where top-level new layers go; the current page when left out. */
    parent: zod.exactOptional(NodeIdSchema),
    dryRun: zod.boolean(),
  }),
  output: zod.object({
    created: zod.array(ApplyCreatedSchema),
    changed: zod.array(zod.string()),
    errors: zod.array(ApplyErrorSchema),
    /** The properties added to components that were there before the call; left out when none. */
    properties: zod.exactOptional(zod.array(ApplyPropertySchema)),
  }),
  meta: {
    write: ({ dryRun }) => !dryRun,
    dryRun: true,
    timeoutMs: LIMITS.requestMaxTimeoutMs,
    needsAllowEdits: ({ dryRun }) => !dryRun,
    turn: OP_TURN.write,
  },
});
