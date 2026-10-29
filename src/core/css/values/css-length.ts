import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_VAR, type TokenRef } from "@/core/css/values/css-var.ts";
import { CSS_PATTERN, CSS_VALUE } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

/** A length as design_apply takes it: pixels, or a token. */
export type LengthValue = number | TokenRef;

/** A box's four sides, top first and clockwise. */
type BoxSides = readonly [top: string, right: string, bottom: string, left: string];

/** Lengths in CSS: written in whole pixels, read in px, as bare numbers where only px can be meant, or as tokens. */
@injectable()
export class CssLength {
  readonly #vars;
  readonly #format;

  constructor(vars = inject(CSS_VAR), format = inject(NUMBER_FORMAT)) {
    this.#vars = vars;
    this.#format = format;
  }

  /** A length in whole pixels, `0` without a unit. */
  px(value: number): string {
    const pixels = this.#format.round(value, PRECISION.spacing);

    return pixels === 0 ? CSS_VALUE.zero : CSS_VALUE.px(pixels);
  }

  /** CSS's box shorthand (C-013): one value when all four sides match, two or three when they pair. */
  shorthand([top, right, bottom, left]: BoxSides): string {
    if (top === right && right === bottom && bottom === left) {
      return top;
    }

    if (top === bottom && right === left) {
      return [top, right].join(CSS_VALUE.space);
    }

    return (right === left ? [top, right, bottom] : [top, right, bottom, left]).join(CSS_VALUE.space);
  }

  /** A length in px ("12px", "0", "-1.5px") or a token; null otherwise. A bare number other than 0 is not one. */
  length(value: string): LengthValue | null {
    const token = this.#vars.token(value);

    if (token !== null) {
      return token;
    }

    const match = CSS_PATTERN.length.exec(value.trim());

    return match === null || (match[2] === undefined && Number(match[1]) !== 0) ? null : Number(match[1]);
  }

  /**
   * A length where a bare number cannot mean anything else (C-016, D-22: a size, a place, a gap, a padding, a radius):
   * "363" as 363 px, as agents write it out of habit. A line height reads with length(): a bare one is a multiple.
   */
  pixels(value: string): LengthValue | null {
    const length = this.length(value);

    return length === null && CSS_PATTERN.bare.test(value.trim()) ? Number(value) : length;
  }
}

export const CSS_LENGTH = new InjectionToken<CssLength>("CssLength");
