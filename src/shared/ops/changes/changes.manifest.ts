import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { CHANGE_BY, CHANGE_KIND } from "@/shared/ops/changes/changes.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** One layer's run of changes by one hand, merged, as the journal keeps it. */
const ChangeSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  change: zod.enum(CHANGE_KIND),
  properties: zod.array(zod.string()),
  by: zod.enum(CHANGE_BY),
  page: zod.string(),
  at: zod.string(),
});

/**
 * What the plugin's change journal holds after a cursor (T-035): free, so it answers while a write runs, and reads
 * nothing of the file, only the journal.
 */
export const changesOp = new OpContract({
  name: OP_NAME.changes,
  input: zod.strictObject({ since: zod.exactOptional(zod.int().check(zod.minimum(0))) }),
  output: zod.object({
    cursor: zod.int(),
    since: zod.string(),
    truncated: zod.boolean(),
    changes: zod.array(ChangeSchema),
  }),
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.free },
});

export type Change = zod.output<typeof ChangeSchema>;
