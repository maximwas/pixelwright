import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { FONT_CATALOG } from "@/plugin/adapters/figma/fonts/font-catalog.ts";
import type { TextStylePlan } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";

/** A text style's fields as Figma takes them, its face first: Figma sets the rest once that is loaded. */
export interface TextStyleLook {
  readonly fontName: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
  readonly letterSpacing?: LetterSpacing;
  readonly textCase?: TextCase;
}

/**
 * What a planned text style becomes in Figma (C-173, P-163): its face found in this Figma (P-077), its own face kept
 * when it still means the plan's family, weight and slant, and the size, line height and letter spacing it holds kept
 * where they render as the plan's (tokens_read rounds each), so a rounded CSS never rewrites what it only rounds.
 */
@injectable()
export class TextStyleLooks {
  readonly #fonts;
  readonly #shorthand;
  readonly #weights = new FontWeight();

  constructor(fonts = inject(FONT_CATALOG), shorthand = inject(FONT_SHORTHAND)) {
    this.#fonts = fonts;
    this.#shorthand = shorthand;
  }

  /** A new call: fonts may have been installed since the last. */
  start(): void {
    this.#fonts.start();
  }

  /** The look of a plan over the style it changes (none for a new one); a dry run's too, so both refuse a family alike. */
  async text({ font, letterSpacing, textCase }: TextStylePlan, held: TextStyle | null): Promise<TextStyleLook> {
    // Its own face first: a condensed or variable face reads as its family and weight only.
    const known = held === null ? [] : [{ fontName: held.fontName, weight: this.#weights.guess(held.fontName.style) }];
    const fontSize = this.#keep(held?.fontSize, font.size, (size) => this.#shorthand.px(size));
    const lineHeight = this.#keep(held?.lineHeight, { ...font.lineHeight } as LineHeight, (height) =>
      this.#shorthand.lineHeight({ ...height }, fontSize),
    );
    // A text style's spacing is in px or percent: core reads no AUTO spacing from CSS. Zero is none in either (C-114).
    const spacing =
      letterSpacing === undefined
        ? undefined
        : this.#keep(held?.letterSpacing, letterSpacing as LetterSpacing, (each) =>
          this.#shorthand.letterSpacing({ ...each }),
        );

    return {
      fontName: await this.#fonts.fontName(font, known),
      fontSize,
      lineHeight,
      ...(spacing === undefined ? {} : { letterSpacing: spacing }),
      ...(textCase === undefined ? {} : { textCase }),
    };
  }

  /** What the style holds when it renders as the plan's, else the plan's. */
  #keep<Value>(
    held: Value | undefined,
    plan: Value,
    render: (value: Value) => unknown,
  ): Value {
    return held !== undefined && render(held) === render(plan) ? held : plan;
  }
}

export const TEXT_STYLE_LOOKS = new InjectionToken<TextStyleLooks>("TextStyleLooks");
