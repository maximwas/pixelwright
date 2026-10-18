import type { TokenError, TokenItem } from "@pixelwright/core";
import type { FontCatalog } from "../../../figma/fonts.ts";
import type { IdLookup } from "../../../figma/id-lookup.ts";
import type { TokenIndex } from "../../../figma/tokens/token-index.ts";
import type { ModeLimit } from "../../../services/mode-limit.ts";

/**
 * What each part of a tokens_apply call needs from the call: whether it writes, the token index, the fonts, and the
 * record.
 */
export interface TokenRun {
  readonly dryRun: boolean;
  /** The fonts this Figma has: a text style's font is found among them. */
  readonly fonts: FontCatalog;
  /** Figma's lookups by id for the call: the file's own from its lists, which Figma gives offline too. */
  readonly lookup: IdLookup;
  /** The modes a collection may have, once Figma has refused one in this file. */
  readonly modeLimit: ModeLimit;
  /** The most modes one of the file's own collections has: as many as its plan surely allows. */
  provenModes(): Promise<number>;
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
