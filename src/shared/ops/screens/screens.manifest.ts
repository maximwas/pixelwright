import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { ScreensOpInputSchema, ScreensOpOutputSchema } from "@/shared/ops/screens/screens.schema.ts";

/** The screen a layer is on and the page's other screens with their children's names (P-123); a read. */
export const screensOp = new OpContract({
  name: OP_NAME.screens,
  input: ScreensOpInputSchema,
  output: ScreensOpOutputSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
