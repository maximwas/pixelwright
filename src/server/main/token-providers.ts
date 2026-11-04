import type { Container } from "@needle-di/core";
import { READ_TOKENS, ReadTokens } from "@/core/design/read-tokens.ts";
import { EASING_CSS, EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { TOKEN_NAMES, TokenNames } from "@/core/kernel/names/token-names.ts";
import { TOKENS_CSS, TokensCss } from "@/core/tokens/formats/css/tokens-css.ts";
import { MODEL_SUMMARY, ModelSummary } from "@/core/tokens/model/model-summary.ts";
import { NUMBER_UNITS, NumberUnits } from "@/core/tokens/model/number-units.ts";
import { STYLE_TOKENS, StyleTokens } from "@/core/tokens/model/style-tokens.ts";
import { TOKEN_MODEL, TokenModel } from "@/core/tokens/model/token-model.ts";
import { VARIABLE_CSS, VariableCss } from "@/core/tokens/model/variable-css.ts";

/**
 * The tokens' bindings: the one naming of tokens and easings (T-163, D-64), design_read's JSON tokens, and
 * tokens_read's model (T-160, T-164, K-003, K-006) with its CSS format and its summary past maxChars (T-161).
 */
export class TokenProviders {
  register(container: Container): void {
    container
      .bind({ provide: TOKEN_NAMES, useClass: TokenNames })
      .bind({ provide: EASING_CSS, useClass: EasingCss })
      .bind({ provide: READ_TOKENS, useClass: ReadTokens })
      .bind({ provide: NUMBER_UNITS, useClass: NumberUnits })
      .bind({ provide: VARIABLE_CSS, useClass: VariableCss })
      .bind({ provide: STYLE_TOKENS, useClass: StyleTokens })
      .bind({ provide: TOKEN_MODEL, useClass: TokenModel })
      .bind({ provide: MODEL_SUMMARY, useClass: ModelSummary })
      .bind({ provide: TOKENS_CSS, useClass: TokensCss });
  }
}
