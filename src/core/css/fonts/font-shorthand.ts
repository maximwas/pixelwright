import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  FONT_NUMBER,
  FONT_PATTERN,
  FONT_TEXT,
  FONT_UNIT,
  FONT_VALUE,
  FONT_WEIGHTS,
} from "@/core/css/fonts/fonts.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

/** A length of text as Figma keeps it: px, percent of the font size, or Figma's own (no value). */
export interface TextLength {
  readonly unit: string;
  readonly value?: number | undefined;
}

/** What the font shorthand says: a run's or a text style's font, size and line height, and a run's weight. */
export interface FontParts {
  readonly fontName: { readonly family: string; readonly style: string };
  readonly fontSize: number;
  readonly lineHeight: TextLength;
  readonly fontWeight?: number | undefined;
}

/** A font as CSS (C-112, C-114): the shorthand `[italic] weight size/line-height 'Family'` and the lengths of text. */
@injectable()
export class FontShorthand {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  /**
   * The weight from `fontWeight`, else the style's name; italic when the style says so; line height in px (a percent
   * of the size too), `normal` for Auto (its px comes with the Auto line height option); the family escaped (O-021).
   */
  font(parts: FontParts): string {
    return FONT_TEXT.shorthand(
      FONT_PATTERN.italic.test(parts.fontName.style),
      parts.fontWeight ?? this.#weight(parts.fontName.style),
      FONT_TEXT.size(this.#px(parts.fontSize), this.#lineHeight(parts.lineHeight, parts.fontSize)),
      parts.fontName.family.replace(FONT_PATTERN.unsafe, FONT_TEXT.escaped),
    );
  }

  /** C-114: em is Figma's percent / 100, px as given; nothing at 0. */
  letterSpacing(spacing: TextLength): string | null {
    return spacing.value === 0 ? null : this.length(spacing);
  }

  /** A length of text in em or px; null for Figma's automatic one. */
  length({ unit, value }: TextLength): string | null {
    if (value === undefined) {
      return null;
    }

    return unit === FONT_UNIT.percent
      ? FONT_TEXT.em(this.#format.round(value / FONT_NUMBER.percent, PRECISION.decimal))
      : this.#px(value);
  }

  #lineHeight({ unit, value }: TextLength, size: number): string {
    if (value === undefined || (unit !== FONT_UNIT.pixels && unit !== FONT_UNIT.percent)) {
      return FONT_VALUE.normal;
    }

    return this.#px(unit === FONT_UNIT.pixels ? value : (size * value) / FONT_NUMBER.percent);
  }

  #px(value: number): string {
    return FONT_TEXT.px(this.#format.round(value, PRECISION.textSpacing));
  }

  #weight(style: string): number {
    return FONT_WEIGHTS.find(([pattern]) => pattern.test(style))?.[1] ?? FONT_NUMBER.regular;
  }
}

export const FONT_SHORTHAND = new InjectionToken<FontShorthand>("FontShorthand");
