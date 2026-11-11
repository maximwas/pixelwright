import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { MODEL_VALUE } from "@/core/tokens/model/model.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";

/** tokens_usage as clients list it (tools.json pins every word): 0.7.0's words, with its budget (D-48). */
export const TOKENS_USAGE_TOOL = {
  name: "tokens_usage",
  title: "Where a token is used",
  description:
    'The layers on the current page (or inside within, or on every page with within: "file") that use a style or variable, named by its token as design_read and tokens_read write it (--White-2 is the second style named White, --h1-font a text style), with where each uses it (fill, stroke, effect, text, a text run, or a bound field). Use it to tell same-named styles apart or to see what a change to a token would touch. raw: true in place of token lists the colours bound to no style and no variable (fills, strokes, text runs, effects, gradient stops), each as #RRGGBB with its count and layers, most used first. At most 500 layers come back (more says there are others); the scan stops at budgetMs with what it found and a note.',
} as const;

/** A token's length, 0.7.0's bounds: `--x` is the shortest. */
export const TOKENS_USAGE = { minToken: 3, maxToken: 300 } as const;

export const TOKENS_USAGE_FIELD = {
  token:
    "A style's or variable's token as design_read or tokens_read writes it: --White-2, --h1-font, --color-bg. Give token or raw, not both.",
  raw: "true: list the colours bound to no style and no variable (fills with gradient stops, strokes, a mixed text's runs, effect colours) instead of a token's layers.",
  colors:
    "With raw: each raw colour as #RRGGBB, its count of layer uses and those layers (property fills, strokes, text for a text run, or effects; hidden when a viewer does not see it), most used first.",
  within:
    'The layer or page to look in, or "file" for every page (loading them all is slow on a big file). Default: the current page.',
  budgetMs: `How long the scan may take, in ms; when it is spent the layers found so far come back with a note. Default: ${LIMITS.opBudgetMs}.`,
} as const;

/** What a token names, as the answer says it. */
export const TOKEN_KIND = {
  paint: "paint style",
  text: "text style",
  effect: "effect style",
  variable: "variable",
} as const;

export type TokenKind = (typeof TOKEN_KIND)[keyof typeof TOKEN_KIND];

/**
 * A style's kind by Figma's style type, and the tokens tokens_read writes it as (K-006, D-20): its own token (a paint's,
 * an effect's shadows) but a text style's, whose font shorthand is --<name>-font; then its parts, a text's letter
 * spacing and case, an effect's blurs. A grid style has no token.
 */
export const STYLE_KIND: Readonly<
  Record<string, { readonly kind: TokenKind; readonly own: boolean; readonly parts: readonly string[] }>
> = {
  PAINT: { kind: TOKEN_KIND.paint, own: true, parts: [] },
  TEXT: {
    kind: TOKEN_KIND.text,
    own: false,
    parts: [MODEL_VALUE.font, CSS_PROPERTY.letterSpacing, CSS_PROPERTY.textTransform],
  },
  EFFECT: { kind: TOKEN_KIND.effect, own: true, parts: [CSS_PROPERTY.filter, CSS_PROPERTY.backdropFilter] },
};

/** A raw colour use's key: one layer's use of one colour under one property counts once. */
export const RAW_USE = {
  key: (
    color: string,
    id: string,
    property: string,
  ) => `${color} ${id} ${property}`
} as const;

export const TOKENS_USAGE_TEXT = {
  oneOf: "Give exactly one of token (a style's or variable's token) and raw: true (the colours bound to neither).",
  notFound: (token: string) => `No style or variable is named ${token} in this file: tokens_read lists them.`,
  cut: (budgetMs: number, found: number) =>
    `The scan stopped at its budget of ${budgetMs} ms: layers holds the ${found} found before it. Look within a smaller layer or give a larger budgetMs.`,
} as const;
