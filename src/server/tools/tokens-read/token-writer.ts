import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKENS_CSS } from "@/core/tokens/formats/css/tokens-css.ts";
import { TOKENS_DTCG } from "@/core/tokens/formats/dtcg/tokens-dtcg.ts";
import type { Tokens } from "@/core/tokens/model/model.schema.ts";
import { TOKEN_FORMAT } from "@/server/tools/tokens-read/tokens-read.constants.ts";
import type { TokensReadInput, TokensReadOutput } from "@/server/tools/tokens-read/tokens-read.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/** The tokens as a format writes them, their size in characters, and the notes of a format that keeps its own. */
export interface Written {
  readonly body: Pick<TokensReadOutput, "css" | "dtcg" | "tokens">;
  readonly size: number;
  /** DTCG's own notes, in place of the model's (which speak of CSS). */
  readonly notes?: readonly string[];
}

/**
 * tokens_read's formats (T-160, K-013): CSS, the model itself (json), or DTCG trees from the raw tokens the model was
 * made of. `tokens` may be the first part of `whole` that fits maxChars (T-161).
 */
@injectable()
export class TokenWriter {
  readonly #css;
  readonly #dtcg;

  constructor(css = inject(TOKENS_CSS), dtcg = inject(TOKENS_DTCG)) {
    this.#css = css;
    this.#dtcg = dtcg;
  }

  written(
    format: TokensReadInput["format"],
    raw: RawTokens,
    tokens: Tokens,
    whole: Tokens,
  ): Written {
    if (format === TOKEN_FORMAT.dtcg) {
      const { trees, notes } = this.#dtcg.write(raw, tokens, whole);

      return { body: { dtcg: trees }, size: JSON.stringify(trees).length, notes };
    }

    if (format === TOKEN_FORMAT.json) {
      return { body: { tokens }, size: JSON.stringify(tokens).length };
    }

    const css = this.#css.write(tokens);

    return { body: { css }, size: css.length };
  }
}

export const TOKEN_WRITER = new InjectionToken<TokenWriter>("TokenWriter");
