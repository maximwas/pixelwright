import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { TOKEN_KIND, TOKENS_USAGE, TOKENS_USAGE_FIELD } from "@/server/tools/tokens-usage/tokens-usage.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { usageOp } from "@/shared/ops/usage/usage.manifest.ts";

const { within, budgetMs } = usageOp.input.shape;

export const TokensUsageInputSchema = zod.strictObject({
  token: zod
    .exactOptional(zod.string().check(zod.minLength(TOKENS_USAGE.minToken), zod.maxLength(TOKENS_USAGE.maxToken)))
    .check(zod.describe(TOKENS_USAGE_FIELD.token)),
  raw: zod.exactOptional(zod.literal(true)).check(zod.describe(TOKENS_USAGE_FIELD.raw)),
  within: within.check(zod.describe(TOKENS_USAGE_FIELD.within)),
  budgetMs: zod._default(budgetMs, LIMITS.opBudgetMs).check(zod.describe(TOKENS_USAGE_FIELD.budgetMs)),
  file: FileInputSchema,
});

const { layers } = usageOp.output.shape;

/** A raw colour: its hex, how many layer uses it has, and those layers, each with where it uses the colour. */
const RawColorSchema = zod.strictObject({ color: zod.string(), count: zod.int(), layers });

/** With token: the style or variable and the layers using it; with raw: the raw colours, most used first. */
export const TokensUsageOutputSchema = zod.strictObject({
  token: zod.exactOptional(zod.string()),
  kind: zod.exactOptional(zod.enum(TOKEN_KIND)),
  name: zod.exactOptional(zod.string()),
  layers: zod.exactOptional(layers),
  colors: zod.exactOptional(zod.array(RawColorSchema)).check(zod.describe(TOKENS_USAGE_FIELD.colors)),
  more: zod.boolean(),
  notes: zod.exactOptional(zod.array(zod.string())),
});

export type TokensUsageInput = zod.output<typeof TokensUsageInputSchema>;

export type TokensUsageOutput = zod.output<typeof TokensUsageOutputSchema>;
