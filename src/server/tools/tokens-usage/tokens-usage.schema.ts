import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { TOKEN_KIND, TOKENS_USAGE, TOKENS_USAGE_FIELD } from "@/server/tools/tokens-usage/tokens-usage.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { usageOp } from "@/shared/ops/usage/usage.manifest.ts";

const { within, budgetMs } = usageOp.input.shape;

export const TokensUsageInputSchema = zod.strictObject({
  token: zod
    .string()
    .check(
      zod.minLength(TOKENS_USAGE.minToken),
      zod.maxLength(TOKENS_USAGE.maxToken),
      zod.describe(TOKENS_USAGE_FIELD.token),
    ),
  within: within.check(zod.describe(TOKENS_USAGE_FIELD.within)),
  budgetMs: zod._default(budgetMs, LIMITS.opBudgetMs).check(zod.describe(TOKENS_USAGE_FIELD.budgetMs)),
  file: FileInputSchema,
});

export const TokensUsageOutputSchema = zod.strictObject({
  token: zod.string(),
  kind: zod.enum(TOKEN_KIND),
  name: zod.string(),
  layers: usageOp.output.shape.layers,
  more: zod.boolean(),
  notes: zod.exactOptional(zod.array(zod.string())),
});

export type TokensUsageInput = zod.output<typeof TokensUsageInputSchema>;

export type TokensUsageOutput = zod.output<typeof TokensUsageOutputSchema>;
