import * as zod from "zod/mini";
import { TokensInputSchema } from "@/core/tokens/plan/plan.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { TOKENS_APPLY_FIELD } from "@/server/tools/tokens-apply/tokens-apply.constants.ts";
import { TokenErrorSchema, TokenItemSchema } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

export const TokensApplyInputSchema = zod.strictObject({
  tokens: TokensInputSchema.check(zod.describe(TOKENS_APPLY_FIELD.tokens)),
  dryRun: DryRunInputSchema,
  version: VersionInputSchema,
  file: FileInputSchema,
});

export const TokensApplyOutputSchema = zod.object({
  created: zod.array(TokenItemSchema),
  updated: zod.array(TokenItemSchema),
  errors: zod.array(TokenErrorSchema),
  notes: zod.exactOptional(zod.array(zod.string())),
  ...WRITER_OUTPUT,
});

export type TokensApplyInput = zod.output<typeof TokensApplyInputSchema>;

export type TokensApplyOutput = zod.output<typeof TokensApplyOutputSchema>;
