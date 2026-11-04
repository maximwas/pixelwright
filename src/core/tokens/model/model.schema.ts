import * as zod from "zod/mini";
import { MODEL_FIELD, VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";

/** A variable's value that points at another variable, as Figma keeps it. */
export const VariableAliasSchema = zod.object({ type: zod.literal(VARIABLE_VALUE.alias), id: zod.string() });

/** A colour as Figma keeps it: channels from 0 to 1, alpha when it has one. */
export const RawColorSchema = zod.object({
  r: zod.number(),
  g: zod.number(),
  b: zod.number(),
  a: zod.exactOptional(zod.number()),
});

/** A composed colour (K-016): a colour and an opacity in percent, either of them a variable. */
export const ComposedColorSchema = zod.object({
  color: zod.union([RawColorSchema, VariableAliasSchema]),
  opacity: zod.union([zod.number(), VariableAliasSchema]),
});

export type ComposedColor = zod.output<typeof ComposedColorSchema>;

/** A style as a token (K-006): its custom property and CSS value, and its other parts as tokens of their own. */
const StyleTokenSchema = zod.object({
  name: zod.string(),
  token: zod.string(),
  value: zod.string(),
  also: zod
    .exactOptional(zod.array(zod.object({ token: zod.string(), value: zod.string() })))
    .check(zod.describe(MODEL_FIELD.also)),
});

/** A variable as tokens_read shows it: its custom property and its CSS value in every mode, by mode name. */
const TokenVariableSchema = zod.object({
  name: zod.string(),
  token: zod.string(),
  type: zod.string(),
  values: zod.record(zod.string(), zod.string()),
  description: zod.exactOptional(zod.string()),
  scopes: zod.exactOptional(zod.array(zod.string())).check(zod.describe(MODEL_FIELD.scopes)),
  codeSyntax: zod.exactOptional(
    zod.object({
      WEB: zod.exactOptional(zod.string()),
      ANDROID: zod.exactOptional(zod.string()),
      iOS: zod.exactOptional(zod.string()),
    }),
  ),
});

/** A collection with its modes, its mode selectors (`[data-brand="dark"]`, none with one mode) and its variables. */
const TokenCollectionSchema = zod.object({
  name: zod.string(),
  modes: zod.array(zod.string()),
  defaultMode: zod.string(),
  selectors: zod.record(zod.string(), zod.string()),
  variables: zod.array(TokenVariableSchema),
});

/** A file's tokens ready for code (T-160): what every format writes from. */
export const TokensSchema = zod.object({
  collections: zod.array(TokenCollectionSchema),
  styles: zod.object({
    paint: zod.array(StyleTokenSchema),
    text: zod.array(StyleTokenSchema),
    effect: zod.array(StyleTokenSchema),
  }),
});

export type Tokens = zod.output<typeof TokensSchema>;

export type TokenCollection = Tokens["collections"][number];

export type TokenVariable = TokenCollection["variables"][number];

export type StyleTokenGroups = Tokens["styles"];

export type StyleToken = StyleTokenGroups["paint"][number];

/** A model too long for one answer, counted (T-161): each collection's modes and variables, and the styles. */
export const SummarySchema = zod.object({
  collections: zod.array(zod.object({ name: zod.string(), modes: zod.array(zod.string()), variables: zod.number() })),
  styles: zod.object({ paint: zod.number(), text: zod.number(), effect: zod.number() }),
});

export type Summary = zod.output<typeof SummarySchema>;

/** The tokens and what could not be written as asked: unresolved aliases, values CSS cannot hold, missing targets. */
export type ReadyTokens = Tokens & { readonly notes: string[] };
