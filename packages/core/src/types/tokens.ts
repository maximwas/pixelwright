import type * as z from "zod";
import type { RawTokensSchema } from "../schemas/tokens.ts";

export type RawTokens = z.output<typeof RawTokensSchema>;

/** A variable as tokens_read shows it: its CSS custom property and its CSS value in every mode, by mode name. */
export interface TokenVariable {
  name: string;
  token: string;
  type: string;
  values: Record<string, string>;
  description?: string;
}

export interface TokenCollection {
  name: string;
  modes: string[];
  defaultMode: string;
  /** Each mode but the default as the CSS selector of its block: `[data-brand="dark"]`, unique in the output. */
  selectors: Record<string, string>;
  variables: TokenVariable[];
}

/** A style as a token: its custom property and CSS value. */
export interface StyleToken {
  name: string;
  token: string;
  value: string;
}

/** A file's tokens ready for code: what tokens_read returns as JSON and turns into CSS. */
export interface TokenModel {
  collections: TokenCollection[];
  styles: { paint: StyleToken[]; text: StyleToken[]; effect: StyleToken[] };
  library?: RawTokens["library"];
  /** What could not be written: unresolved aliases, values CSS has no use for, paint styles it cannot draw. */
  notes: string[];
}
