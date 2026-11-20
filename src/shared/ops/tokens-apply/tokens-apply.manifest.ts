import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { TokenErrorSchema, TokenItemSchema, TokensPlanSchema } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/**
 * tokens_apply's plan written in Figma (T-165, P-163): collections, modes, variables, aliases and styles, each refusal
 * its own error while the rest is written, the whole call one undo step. A dry run walks the same way without writing,
 * refuses the modes the file's Figma plan is known to refuse (B-055) and needs no Allow edits. A write runs alone, so a
 * retry's read waits for it and plans nothing it made (B-005); the timeout is the longest an op may ask for.
 */
export const tokensApplyOp = new OpContract({
  name: OP_NAME.tokensApply,
  input: zod.strictObject({ plan: TokensPlanSchema, dryRun: zod.boolean() }),
  output: zod.object({
    created: zod.array(TokenItemSchema),
    updated: zod.array(TokenItemSchema),
    errors: zod.array(TokenErrorSchema),
    notes: zod.exactOptional(zod.array(zod.string())),
  }),
  meta: {
    write: ({ dryRun }) => !dryRun,
    dryRun: true,
    timeoutMs: LIMITS.requestMaxTimeoutMs,
    needsAllowEdits: ({ dryRun }) => !dryRun,
    turn: OP_TURN.write,
  },
});
