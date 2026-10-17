import type { TokenError, TokenItem } from "@pixelwright/core";
import type { FontCatalog } from "../../../figma/fonts.ts";
import type { TokenIndex } from "../../../figma/tokens/token-index.ts";

/**
 * What each part of a tokens_apply call needs from the call: whether it writes, the token index, the fonts, and the
 * record.
 */
export interface TokenRun {
  readonly dryRun: boolean;
  /** The fonts this Figma has: a text style's font is found among them. */
  readonly fonts: FontCatalog;
  /** The token index, built once per call when first asked for. */
  index(): Promise<TokenIndex>;
  created(item: TokenItem): void;
  updated(item: TokenItem): void;
  failed(error: TokenError): void;
  /** Something written that may not read back as meant. */
  noted(note: string): void;
  /** Says the file changed, so the call closes one undo step. */
  wrote(): void;
}
