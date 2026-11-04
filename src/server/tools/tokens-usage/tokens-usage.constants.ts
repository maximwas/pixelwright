import { LIMITS } from "@/shared/limits/limits.constants.ts";

/** tokens_usage as clients list it (tools.json pins every word): 0.7.0's words, with its budget (D-48). */
export const TOKENS_USAGE_TOOL = {
  name: "tokens_usage",
  title: "Where a token is used",
  description:
    'The layers on the current page (or inside within, or on every page with within: "file") that use a style or variable, named by its token as design_read and tokens_read write it (--White-2 is the second style named White, --h1-font a text style), with where each uses it (fill, stroke, effect, text, a text run, or a bound field). Use it to tell same-named styles apart or to see what a change to a token would touch. At most 500 layers come back (more says there are others); the scan stops at budgetMs with what it found and a note.',
} as const;

/** A token's length, 0.7.0's bounds: `--x` is the shortest. */
export const TOKENS_USAGE = { minToken: 3, maxToken: 300 } as const;

export const TOKENS_USAGE_FIELD = {
  token: "A style's or variable's token as design_read or tokens_read writes it: --White-2, --h1-font, --color-bg.",
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

/** A style's kind by Figma's style type; a grid style has no token. */
export const STYLE_KIND: Readonly<Record<string, TokenKind>> = {
  PAINT: TOKEN_KIND.paint,
  TEXT: TOKEN_KIND.text,
  EFFECT: TOKEN_KIND.effect,
};

export const TOKENS_USAGE_TEXT = {
  notFound: (token: string) => `No style or variable is named ${token} in this file: tokens_read lists them.`,
  cut: (budgetMs: number, found: number) =>
    `The scan stopped at its budget of ${budgetMs} ms: layers holds the ${found} found before it. Look within a smaller layer or give a larger budgetMs.`,
} as const;
