import { InjectionToken, inject, injectable } from "@needle-di/core";
import { Closest } from "@/core/kernel/names/closest.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { FONT_NUMBER, FONT_PATTERN, FONT_TEXT } from "@/plugin/adapters/figma/fonts/fonts.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

export type FontSpec = NonNullable<FigmaProps["font"]>;

/** A font a text uses now, with the weight Figma reports for it (a variable font's own, like 590). */
export interface KnownFont {
  readonly fontName: FontName;
  readonly weight: number;
}

/**
 * The font a family, weight and slant mean in this Figma (P-077): the family in any case, the slant by italic or
 * oblique, the style nearest the weight within 50, a plain one first; the fonts Figma lists asked for once per call.
 */
@injectable()
export class FontCatalog {
  readonly #factory;
  readonly #closest = new Closest();
  readonly #weights = new FontWeight();
  #fonts: Promise<Font[]> | null = null;

  constructor(factory = inject(LAYER_FACTORY)) {
    this.#factory = factory;
  }

  /** A new call: fonts may have been installed since the last. */
  start(): void {
    this.#fonts = null;
  }

  /**
   * The one a changed text already uses for the weight and slant (design_read wrote its weight), else the family's
   * nearest style; an error names the near family or the styles the family has.
   */
  async fontName(spec: FontSpec, known: readonly KnownFont[] = []): Promise<FontName> {
    const family = spec.family.toLowerCase();
    const slanted = (style: string) => FONT_PATTERN.slanted.test(style) === spec.italic;
    const used = known.find(
      ({ fontName, weight }) =>
        fontName.family.toLowerCase() === family && weight === spec.weight && slanted(fontName.style),
    );

    if (used !== undefined) {
      return used.fontName;
    }

    this.#fonts ??= this.#factory.fonts();

    const fonts = (await this.#fonts).map(({ fontName }) => fontName);
    const styles = fonts.filter((font) => font.family.toLowerCase() === family);

    if (styles.length === 0) {
      const near = this.#closest.of(spec.family, new Set(fonts.map((font) => font.family)));

      throw new WriteError(FONT_TEXT.noFamily(spec.family), near === null ? FONT_TEXT.install : FONT_TEXT.near(near));
    }

    return this.#nearest(spec, styles, slanted);
  }

  #nearest(
    spec: FontSpec,
    styles: readonly FontName[],
    slanted: (style: string) => boolean,
  ): FontName {
    const distance = (font: FontName) => Math.abs(this.#weights.guess(font.style) - spec.weight);
    const plain = (font: FontName) => (FONT_PATTERN.plain.test(font.style) ? 0 : font.style.length);
    const [best] = styles
      .filter((font) => slanted(font.style) && distance(font) <= FONT_NUMBER.nearWeight)
      .sort((first, second) => distance(first) - distance(second) || plain(first) - plain(second));

    if (best === undefined) {
      const family = styles[0]?.family ?? spec.family;

      throw new WriteError(
        FONT_TEXT.noWeight(
          family,
          spec.weight,
          spec.italic,
          styles.map((font) => font.style),
        ),
      );
    }

    return best;
  }
}

export const FONT_CATALOG = new InjectionToken<FontCatalog>("FontCatalog");
