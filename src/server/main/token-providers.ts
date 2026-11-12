import type { Container } from "@needle-di/core";
import { READ_TOKENS, ReadTokens } from "@/core/design/read-tokens.ts";
import { EASING_CSS, EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { FONT_WEIGHT, FontWeight } from "@/core/kernel/names/font-weight.ts";
import { TOKEN_NAMES, TokenNames } from "@/core/kernel/names/token-names.ts";
import { TOKENS_CSS, TokensCss } from "@/core/tokens/formats/css/tokens-css.ts";
import { DTCG_PATHS, DtcgPaths } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DTCG_REFERENCES, DtcgReferences } from "@/core/tokens/formats/dtcg/dtcg-references.ts";
import { DTCG_STYLES, DtcgStyles } from "@/core/tokens/formats/dtcg/dtcg-styles.ts";
import { DTCG_TYPES, DtcgTypes } from "@/core/tokens/formats/dtcg/dtcg-types.ts";
import { DTCG_VALUES, DtcgValues } from "@/core/tokens/formats/dtcg/dtcg-values.ts";
import { TOKENS_DTCG, TokensDtcg } from "@/core/tokens/formats/dtcg/tokens-dtcg.ts";
import { MODEL_SUMMARY, ModelSummary } from "@/core/tokens/model/model-summary.ts";
import { NUMBER_UNITS, NumberUnits } from "@/core/tokens/model/number-units.ts";
import { STYLE_TOKENS, StyleTokens } from "@/core/tokens/model/style-tokens.ts";
import { TOKEN_MODEL, TokenModel } from "@/core/tokens/model/token-model.ts";
import { VARIABLE_CSS, VariableCss } from "@/core/tokens/model/variable-css.ts";
import { TOKEN_WRITER, TokenWriter } from "@/server/tools/tokens-read/token-writer.ts";

/**
 * The tokens' bindings: the one naming of tokens and easings (T-163, D-64), design_read's JSON tokens, and
 * tokens_read's model (T-160, T-164, K-003, K-006) with its CSS and DTCG formats (K-013..K-017) and its summary past
 * maxChars (T-161); the weight guessed from a font style's name (K-074).
 */
export class TokenProviders {
  register(container: Container): void {
    container
      .bind({ provide: TOKEN_NAMES, useClass: TokenNames })
      .bind({ provide: FONT_WEIGHT, useClass: FontWeight })
      .bind({ provide: EASING_CSS, useClass: EasingCss })
      .bind({ provide: READ_TOKENS, useClass: ReadTokens })
      .bind({ provide: NUMBER_UNITS, useClass: NumberUnits })
      .bind({ provide: VARIABLE_CSS, useClass: VariableCss })
      .bind({ provide: STYLE_TOKENS, useClass: StyleTokens })
      .bind({ provide: TOKEN_MODEL, useClass: TokenModel })
      .bind({ provide: MODEL_SUMMARY, useClass: ModelSummary })
      .bind({ provide: TOKENS_CSS, useClass: TokensCss })
      .bind({ provide: DTCG_PATHS, useClass: DtcgPaths })
      .bind({ provide: DTCG_TYPES, useClass: DtcgTypes })
      .bind({ provide: DTCG_REFERENCES, useClass: DtcgReferences })
      .bind({ provide: DTCG_VALUES, useClass: DtcgValues })
      .bind({ provide: DTCG_STYLES, useClass: DtcgStyles })
      .bind({ provide: TOKENS_DTCG, useClass: TokensDtcg })
      .bind({ provide: TOKEN_WRITER, useClass: TokenWriter });
  }
}
