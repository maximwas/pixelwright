import { isTokenDimension, isTokenEOF, isTokenNumber, isTokenPercentage, tokenize } from "@csstools/css-tokenizer";
import { BUILD_STYLES_WORD } from "@/core/checks/build-styles/build-styles.constants.ts";

/** One number, percentage or dimension as CSS reads it: "12px", "-0.02em", "50%", "0". */
export class Dimension {
  readonly value: number;
  /** In lower case: "%" for a percentage, "" for a plain number. */
  readonly unit: string;

  private constructor(value: number, unit: string) {
    this.value = value;
    this.unit = unit;
  }

  /** The value's one number, percentage or dimension; null for anything else, or more than one. */
  static parse(css: string): Dimension | null {
    const tokens = tokenize({ css: css.trim() }).filter((token) => !isTokenEOF(token));
    const [token] = tokens;

    if (tokens.length !== 1 || token === undefined) {
      return null;
    }

    if (isTokenDimension(token)) {
      return new Dimension(token[4].value, token[4].unit.toLowerCase());
    }

    if (isTokenPercentage(token)) {
      return new Dimension(token[4].value, BUILD_STYLES_WORD.percent);
    }

    return isTokenNumber(token) ? new Dimension(token[4].value, "") : null;
  }

  /** In px, a bare 0 as one; null in any other unit. */
  pixels(): number | null {
    return this.#lengthUnit() === BUILD_STYLES_WORD.px ? this.value : null;
  }

  /** A plain number; null for a dimension or a percentage. */
  number(): number | null {
    return this.unit === "" ? this.value : null;
  }

  /** A length (or an angle): a unit other than a percent, or a bare 0. */
  isLength(): boolean {
    const unit = this.#lengthUnit();

    return unit !== "" && unit !== BUILD_STYLES_WORD.percent;
  }

  /** The same as another in one unit, within `precision`. */
  near(other: Dimension, precision: number): boolean {
    return this.#lengthUnit() === other.#lengthUnit() && Math.abs(this.value - other.value) <= precision;
  }

  /** CSS writes a length of 0 without its unit. */
  #lengthUnit(): string {
    return this.unit === "" && this.value === 0 ? BUILD_STYLES_WORD.px : this.unit;
  }
}
