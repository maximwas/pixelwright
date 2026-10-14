import type { TokenError, TokenItem } from "@pixelwright/core";
import type { TokenIndex } from "../../../figma/tokens/token-index.ts";

/** What each part of a tokens_apply call needs from the call: whether it writes, the token index, and the record. */
export interface TokenRun {
  readonly dryRun: boolean;
  /** The token index, built once per call when first asked for. */
  index(): Promise<TokenIndex>;
  created(item: TokenItem): void;
  updated(item: TokenItem): void;
  failed(error: TokenError): void;
  /** Says the file changed, so the call closes one undo step. */
  wrote(): void;
}
