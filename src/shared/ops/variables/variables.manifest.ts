import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { RawTokensSchema, VariablesOpInputSchema } from "@/shared/ops/variables/variables.schema.ts";

/** The file's tokens as Figma keeps them (T-160, P-125): a read; the server builds the token model. */
export const variablesOp = new OpContract({
  name: OP_NAME.variables,
  input: VariablesOpInputSchema,
  output: RawTokensSchema,
  meta: { write: false, dryRun: false, timeoutMs: LIMITS.requestTimeoutMs, needsAllowEdits: false, turn: OP_TURN.read },
});
