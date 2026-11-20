import * as zod from "zod/mini";
import { PLAN_FIELD, TOKENS_APPLY } from "@/core/tokens/plan/plan.constants.ts";
import { VARIABLE_SCOPES } from "@/core/tokens/scopes/scopes.constants.ts";

const NameSchema = zod.string().check(zod.minLength(TOKENS_APPLY.minName), zod.maxLength(TOKENS_APPLY.maxName));

const CssSchema = zod.string().check(zod.maxLength(TOKENS_APPLY.maxValue));

const CodeNameSchema = zod.exactOptional(zod.string().check(zod.maxLength(TOKENS_APPLY.maxName)));

/** A field of tokens_read's that tokens_apply reads past, so its JSON goes back as it is. */
const ReadPastSchema = zod.exactOptional(zod.unknown()).check(zod.describe(PLAN_FIELD.readPast));

const VariableInputSchema = zod.strictObject({
  name: NameSchema,
  type: zod.exactOptional(zod.string().check(zod.maxLength(TOKENS_APPLY.maxType))),
  values: zod.record(NameSchema, CssSchema),
  description: zod.exactOptional(CssSchema),
  token: CodeNameSchema,
  scopes: zod
    .exactOptional(zod.array(zod.enum(VARIABLE_SCOPES)).check(zod.maxLength(VARIABLE_SCOPES.length)))
    .check(zod.describe(PLAN_FIELD.scopes)),
  codeSyntax: zod
    .exactOptional(zod.strictObject({ WEB: CodeNameSchema, ANDROID: CodeNameSchema, iOS: CodeNameSchema }))
    .check(zod.describe(PLAN_FIELD.codeSyntax)),
  id: ReadPastSchema,
  aliasOf: ReadPastSchema,
});

const CollectionInputSchema = zod.strictObject({
  name: NameSchema,
  modes: zod.exactOptional(zod.array(NameSchema).check(zod.maxLength(TOKENS_APPLY.maxModes))),
  variables: zod.array(VariableInputSchema).check(zod.maxLength(TOKENS_APPLY.maxVariables)),
  defaultMode: ReadPastSchema,
  selectors: ReadPastSchema,
});

/** A style as tokens_read lists it: its name, its CSS value and its token. */
const StyleFields = {
  name: NameSchema,
  value: CssSchema,
  token: CodeNameSchema.check(zod.describe(PLAN_FIELD.styleToken)),
};

/** A text or effect style's other parts as tokens of their own: letter spacing and case, blurs. */
const AlsoSchema = zod
  .exactOptional(
    zod
      .array(zod.strictObject({ token: zod.string().check(zod.maxLength(TOKENS_APPLY.maxName)), value: CssSchema }))
      .check(zod.maxLength(TOKENS_APPLY.maxAlso)),
  )
  .check(zod.describe(PLAN_FIELD.also));

const PaintStylesSchema = zod._default(
  zod.array(zod.strictObject(StyleFields)).check(zod.maxLength(TOKENS_APPLY.maxStyles)),
  [],
);

const PartStylesSchema = zod._default(
  zod.array(zod.strictObject({ ...StyleFields, also: AlsoSchema })).check(zod.maxLength(TOKENS_APPLY.maxStyles)),
  [],
);

/**
 * The tokens tokens_apply takes (K-018): tokens_read's own JSON as it answers it in `tokens` (its ids, aliasOf,
 * defaultMode and selectors read past), or the same shape by hand. Values are CSS, as tokens_read writes them.
 */
export const TokensInputSchema = zod.strictObject({
  collections: zod._default(zod.array(CollectionInputSchema).check(zod.maxLength(TOKENS_APPLY.maxCollections)), []),
  styles: zod._default(
    zod.strictObject({ paint: PaintStylesSchema, text: PartStylesSchema, effect: PartStylesSchema }),
    { paint: [], text: [], effect: [] },
  ),
});

export type TokensInput = zod.output<typeof TokensInputSchema>;

export type CollectionInput = TokensInput["collections"][number];

export type VariableInput = CollectionInput["variables"][number];

export type StyleInput = TokensInput["styles"]["text"][number];
