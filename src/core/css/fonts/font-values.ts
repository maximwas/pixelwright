import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FONT_NUMBER, FONT_PATTERN, FONT_VALUE } from "@/core/css/fonts/fonts.constants.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { INTENT_TEXT_UNIT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

export type FontSpec = NonNullable<FigmaProps["font"]>;
type TextLength = FontSpec["lineHeight"];
type Spacing = NonNullable<FigmaProps["letterSpacing"]>;

/** design_read's font values read back in Figma's terms (C-112..C-115): the shorthand, letter spacing, a decoration's lengths. */
@injectable()
export class FontValues {
  readonly #lengths;
  readonly #format;
  readonly #split;

  constructor(
    lengths = inject(CSS_LENGTH),
    format = inject(NUMBER_FORMAT),
    split = inject(CSS_SPLIT),
  ) {
    this.#lengths = lengths;
    this.#format = format;
    this.#split = split;
  }

  /** `[italic] weight size/line-height 'Family'`, the shorthand design_read writes; a fallback list keeps its first. */
  font(value: string): FontSpec | null {
    const match = FONT_PATTERN.shorthand.exec(value.trim());

    if (match === null) {
      return null;
    }

    const [, slant, weight, size, height, families] = match;
    const [first = ""] = this.#split.split(families ?? "", CSS_SEPARATOR.comma);
    const family = first.replace(FONT_PATTERN.quotes, "");
    const lineHeight = this.#lineHeight(height);

    if (family === "" || lineHeight === null) {
      return null;
    }

    return {
      family,
      weight: this.#weight(weight),
      italic: slant === FONT_VALUE.italic || slant === FONT_VALUE.oblique,
      size: Number(size),
      lineHeight,
    };
  }

  /** Letter spacing in em (Figma's percent of the font size) or px; normal is none. */
  letterSpacing(value: string): Spacing | null {
    return value === FONT_VALUE.normal ? { unit: INTENT_TEXT_UNIT.PIXELS, value: 0 } : this.#spacing(value);
  }

  /** A decoration's offset or thickness: in px, in em, or auto. */
  textLength(value: string): TextLength | null {
    return value === FONT_VALUE.auto ? { unit: INTENT_TEXT_UNIT.AUTO } : this.#spacing(value);
  }

  #spacing(value: string): Spacing | null {
    const em = FONT_PATTERN.em.exec(value);
    const pixels = this.#lengths.length(value);

    if (em !== null) {
      return { unit: INTENT_TEXT_UNIT.PERCENT, value: this.#percent(Number(em[1])) };
    }

    return typeof pixels === "number" ? { unit: INTENT_TEXT_UNIT.PIXELS, value: pixels } : null;
  }

  #weight(weight: string | undefined): number {
    if (weight === undefined || weight === FONT_VALUE.normal) {
      return FONT_VALUE.normalWeight;
    }

    return weight === FONT_VALUE.bold ? FONT_VALUE.boldWeight : Number(weight);
  }

  /** Normal is Auto; px, a percent, or a multiple of the size (Figma's percent). */
  #lineHeight(value: string | undefined): TextLength | null {
    if (value === undefined || value === FONT_VALUE.normal) {
      return { unit: INTENT_TEXT_UNIT.AUTO };
    }

    const pixels = FONT_PATTERN.pixels.exec(value);
    const percent = FONT_PATTERN.percent.exec(value.trim());
    const multiple = value.replace(FONT_PATTERN.emSuffix, "").trim();

    if (pixels !== null) {
      return { unit: INTENT_TEXT_UNIT.PIXELS, value: Number(pixels[1]) };
    }

    if (percent !== null) {
      return { unit: INTENT_TEXT_UNIT.PERCENT, value: Number(percent[1]) };
    }

    return FONT_PATTERN.number.test(multiple)
      ? { unit: INTENT_TEXT_UNIT.PERCENT, value: this.#percent(Number(multiple)) }
      : null;
  }

  #percent(share: number): number {
    return this.#format.round(share * FONT_NUMBER.percent, PRECISION.written);
  }
}

export const FONT_VALUES = new InjectionToken<FontValues>("FontValues");
