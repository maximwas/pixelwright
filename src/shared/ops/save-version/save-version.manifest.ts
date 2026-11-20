import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { SAVE_VERSION } from "@/shared/ops/save-version/save-version.constants.ts";

/**
 * A named version in the file's history (P-025): it changes the history, so it needs Allow edits; its write turn runs
 * after every write before it, so the version holds them, with no timing (T-180).
 */
export const saveVersionOp = new OpContract({
  name: OP_NAME.saveVersion,
  input: zod.strictObject({
    title: zod.string().check(zod.minLength(1), zod.maxLength(SAVE_VERSION.titleChars)),
    description: zod.string().check(zod.minLength(1), zod.maxLength(SAVE_VERSION.descriptionChars)),
  }),
  output: zod.object({ id: zod.nullable(zod.string()) }),
  meta: { write: true, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: true, turn: OP_TURN.write },
});
