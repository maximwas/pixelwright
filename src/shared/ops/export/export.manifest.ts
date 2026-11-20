import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { ExportInputSchema, ExportOutputSchema } from "@/shared/ops/export/export.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

/** A layer rendered and held for chunk (T-070, T-075): a read, so it never needs Allow edits. */
export const exportOp = new OpContract({
  name: OP_NAME.export,
  input: ExportInputSchema,
  output: ExportOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
