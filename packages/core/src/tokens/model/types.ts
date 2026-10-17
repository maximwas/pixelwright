import type { RawTokens } from "../raw-tokens.ts";
import type { CodeSyntax } from "../scopes.ts";

/** A variable as tokens_read shows it: its CSS custom property and its CSS value in every mode, by mode name. */
export interface TokenVariable {
  name: string;
  token: string;
  type: string;
  values: Record<string, string>;
  description?: string;
  /** The fields Figma's pickers offer it for, when not every field: [] hides it from all of them. */
  scopes?: string[];
  /** Its name in code per platform, when its designer gave one. */
  codeSyntax?: CodeSyntax;
}

export interface TokenCollection {
  name: string;
  modes: string[];
  defaultMode: string;
  /** Each mode as the CSS selector of its block (`[data-brand="dark"]`), unique in the output; none with one mode. */
  selectors: Record<string, string>;
  variables: TokenVariable[];
}

/** A style as a token: its custom property and CSS value. */
export interface StyleToken {
  name: string;
  token: string;
  value: string;
  /** A text style's other properties as tokens of their own: --Caption-letter-spacing, --Caption-text-transform. */
  also?: { token: string; value: string }[];
}

/** The paint, text and effect styles as tokens. */
export interface StyleTokens {
  paint: StyleToken[];
  text: StyleToken[];
  effect: StyleToken[];
}

/** A file's tokens ready for code: what tokens_read returns as JSON and turns into CSS. */
export interface TokenModel {
  collections: TokenCollection[];
  styles: StyleTokens;
  library?: RawTokens["library"];
  /** What could not be written: unresolved aliases, values CSS has no use for, paint styles it cannot draw. */
  notes: string[];
}
