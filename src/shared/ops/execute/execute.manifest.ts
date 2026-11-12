import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/**
 * Code run in the plugin as the body of an async function (T-150): a write that always needs Allow edits and has no
 * dry run. The server and the watchdog wait a little past the code's own time, never less than the usual wait (T-156);
 * the op itself answers when the code's time is up, the code still running.
 */
export const executeOp = new OpContract({
  name: OP_NAME.execute,
  input: zod.strictObject({
    code: zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE.codeChars)),
    timeoutMs: zod.int().check(zod.minimum(1), zod.maximum(EXECUTE.maxMs)),
  }),
  output: zod.object({ result: zod.unknown(), logs: zod.array(zod.string()), error: zod.exactOptional(zod.string()) }),
  meta: {
    write: true,
    dryRun: false,
    timeoutMs: ({ timeoutMs }) => Math.max(LIMITS.requestTimeoutMs, timeoutMs + EXECUTE.answerMarginMs),
    needsAllowEdits: true,
    turn: OP_TURN.write,
  },
});
