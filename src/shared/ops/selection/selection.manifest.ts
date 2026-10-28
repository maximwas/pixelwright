import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { SelectionOutputSchema } from "@/shared/ops/selection/selection.schema.ts";

/** The layers the user selected on the current page (T-030): the default target of many tools. */
export const selectionOp = new OpContract({
  name: OP_NAME.selection,
  input: zod.strictObject({}),
  output: SelectionOutputSchema,
  meta: {
    write: false,
    dryRun: false,
    timeoutMs: LIMITS.requestTimeoutMs,
    needsAllowEdits: false,
    turn: OP_TURN.read,
  },
});
