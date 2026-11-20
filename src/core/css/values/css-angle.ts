import { isTokenDimension, isTokenEOF, tokenize } from "@csstools/css-tokenizer";
import { InjectionToken, injectable } from "@needle-di/core";
import { ANGLE_UNITS } from "@/core/css/values/values.constants.ts";

/** A CSS angle, the one reader of transform's rotate() and the gradients' angles. */
@injectable()
export class CssAngle {
  /** Degrees from one dimension in deg, grad, rad or turn; null for anything else (a bare number, a percent). */
  degrees(value: string): number | null {
    const tokens = tokenize({ css: value.trim() }).filter((token) => !isTokenEOF(token));
    const [token] = tokens;

    if (tokens.length !== 1 || token === undefined || !isTokenDimension(token)) {
      return null;
    }

    const degrees = ANGLE_UNITS[token[4].unit.toLowerCase()];

    return degrees === undefined ? null : token[4].value * degrees;
  }
}

export const CSS_ANGLE = new InjectionToken<CssAngle>("CssAngle");
