import * as zod from "zod/mini";
import { MODEL_FIELD } from "@/core/tokens/model/model.constants.ts";

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

type Tokens = zod.output<typeof TokensSchema>;

export type TokenCollection = Tokens["collections"][number];

export type TokenVariable = TokenCollection["variables"][number];

export type StyleTokenGroups = Tokens["styles"];

export type StyleToken = StyleTokenGroups["paint"][number];

/** The tokens and what could not be written as asked: unresolved aliases, values CSS cannot hold, missing targets. */
export type ReadyTokens = Tokens & { readonly notes: string[] };
