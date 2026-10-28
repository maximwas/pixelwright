import * as zod from "zod/mini";
import { OpContract } from "@/shared/ops/op-contract/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { PING_TIMEOUT_MS } from "@/shared/ops/ping/ping.constants.ts";

/** status probe's round trip (T-021): free, so a long read never holds it; quiet, so the activity list skips it. */
export const pingOp = new OpContract({
  name: OP_NAME.ping,
  input: zod.strictObject({}),
  output: zod.object({ pong: zod.literal(true) }),
  meta: {
    write: false,
    dryRun: false,
    timeoutMs: PING_TIMEOUT_MS,
    needsAllowEdits: false,
    turn: OP_TURN.free,
    quiet: true,
  },
});
