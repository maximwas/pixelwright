import * as zod from "zod/mini";
import { BindResultSchema } from "@/core/tokens/bind/bind.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { BIND_INSTANCES, TOKENS_BIND, TOKENS_BIND_FIELD } from "@/server/tools/tokens-bind/tokens-bind.constants.ts";
import { BIND_KIND, BIND_LIMIT, BIND_WITHIN } from "@/shared/ops/bind/bind.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** A token as design_read and tokens_read write it (--brand, --h1-font), or a text style by its name (h1). */
const TokenSchema = zod.string().check(zod.minLength(1), zod.maxLength(TOKENS_BIND.tokenChars));

/** The call's pick for a value several tokens hold, or a value to snap to a token (it then takes the token's value). */
const ChoiceSchema = zod.strictObject({
  value: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(TOKENS_BIND.valueChars), zod.describe(TOKENS_BIND_FIELD.value)),
  token: TokenSchema,
  field: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(TOKENS_BIND.fieldChars)))
    .check(zod.describe(TOKENS_BIND_FIELD.field)),
});

const RemapSchema = zod.strictObject({ from: TokenSchema, to: TokenSchema });

export const TokensBindInputSchema = zod.strictObject({
  within: zod
    .exactOptional(zod.union([zod.literal(BIND_WITHIN.file), NodeIdSchema]))
    .check(zod.describe(TOKENS_BIND_FIELD.within)),
  kinds: zod
    ._default(zod.array(zod.enum(BIND_KIND)).check(zod.minLength(1)), Object.values(BIND_KIND))
    .check(zod.describe(TOKENS_BIND_FIELD.kinds)),
  choose: zod
    ._default(zod.array(ChoiceSchema).check(zod.maxLength(TOKENS_BIND.maxChoices)), [])
    .check(zod.describe(TOKENS_BIND_FIELD.choose)),
  remap: zod
    ._default(zod.array(RemapSchema).check(zod.maxLength(BIND_LIMIT.maxRemaps)), [])
    .check(zod.describe(TOKENS_BIND_FIELD.remap)),
  instances: zod
    ._default(zod.enum(BIND_INSTANCES), BIND_INSTANCES.leave)
    .check(zod.describe(TOKENS_BIND_FIELD.instances)),
  dryRun: DryRunInputSchema,
  version: VersionInputSchema,
  file: FileInputSchema,
});

export const TokensBindOutputSchema = zod.extend(BindResultSchema, { summary: zod.string(), ...WRITER_OUTPUT });

export type TokensBindInput = zod.output<typeof TokensBindInputSchema>;

export type TokensBindOutput = zod.output<typeof TokensBindOutputSchema>;
