import type { TokenModel } from "../model/types.ts";
import type { RawTokens } from "../raw-tokens.ts";
import type { TokenFilter } from "../token-filter.ts";

/** The formats tokens_read writes the tokens in. */
export type TokenFormatName = "css" | "json" | "dtcg";

/** What a format writes from: the tokens as Figma keeps them, their model, and the collections asked for. */
export interface TokenSource {
  readonly raw: RawTokens;
  readonly model: TokenModel;
  readonly filter: TokenFilter;
}

/** A format's part of tokens_read's answer. */
export interface FormattedTokens<Body extends object> {
  /** The fields the format adds to the answer. */
  readonly body: Body;
  /** What this format could not hold, beyond the model's own notes. */
  readonly notes: readonly string[];
  /** The characters the answer's tokens take, which maxChars is measured against. */
  readonly size: number;
}

/** One way of writing the tokens (a strategy tokens_read picks by name), giving answers of its own shape. */
export interface TokenFormat<Body extends object> {
  write(source: TokenSource): FormattedTokens<Body>;
  /** For a format that can be cut between tokens: as many whole tokens as fit in maxChars, in order, and of how many. */
  start?(source: TokenSource, maxChars: number): { body: Body; shown: number; total: number };
}
