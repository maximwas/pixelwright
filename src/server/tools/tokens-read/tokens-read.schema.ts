import * as zod from "zod/mini";
import { SummarySchema, TokensSchema } from "@/core/tokens/model/model.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { TOKEN_FORMAT, TOKENS_READ, TOKENS_READ_FIELD } from "@/server/tools/tokens-read/tokens-read.constants.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";
import { LibraryCollectionSchema } from "@/shared/ops/variables/variables.schema.ts";

const { within } = variablesOp.input.shape;

export const TokensReadInputSchema = zod.object({
  collections: zod
    .exactOptional(
      zod
        .array(zod.string().check(zod.minLength(TOKENS_READ.minName), zod.maxLength(TOKENS_READ.maxName)))
        .check(zod.minLength(TOKENS_READ.minCollections), zod.maxLength(TOKENS_READ.maxCollections)),
    )
    .check(zod.describe(TOKENS_READ_FIELD.collections)),
  libraries: zod._default(zod.boolean(), false).check(zod.describe(TOKENS_READ_FIELD.libraries)),
  used: zod._default(zod.boolean(), true).check(zod.describe(TOKENS_READ_FIELD.used)),
  within: within.check(zod.describe(TOKENS_READ_FIELD.within)),
  format: zod._default(zod.enum(TOKEN_FORMAT), TOKEN_FORMAT.css).check(zod.describe(TOKENS_READ_FIELD.format)),
  maxChars: zod
    ._default(
      zod.int().check(zod.minimum(TOKENS_READ.minChars), zod.maximum(TOKENS_READ.maxChars)),
      TOKENS_READ.defaultChars,
    )
    .check(zod.describe(TOKENS_READ_FIELD.maxChars)),
  file: FileInputSchema,
});

export const TokensReadOutputSchema = zod.object({
  format: zod.enum(TOKEN_FORMAT),
  css: zod.exactOptional(zod.string()),
  dtcg: zod.exactOptional(zod.record(zod.string(), zod.record(zod.string(), zod.unknown()))),
  summary: zod.exactOptional(SummarySchema),
  tokens: zod.exactOptional(TokensSchema),
  library: zod.exactOptional(zod.array(LibraryCollectionSchema)),
  notes: zod.array(zod.string()),
});

export type TokensReadInput = zod.output<typeof TokensReadInputSchema>;

export type TokensReadOutput = zod.output<typeof TokensReadOutputSchema>;
