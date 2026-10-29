import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { GUESS_ALIGN, GUESS_CSS, GUESS_JUSTIFY, HINT_FIGMA, HINT_LABEL } from "@/core/design/hints/hints.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** What Figma guesses for a frame placed by hand (inferredAutoLayout). */
type Guess = NonNullable<ReadLayer["inferredLayout"]>;

/** Figma's guess at the flow a frame placed by hand would have, as the CSS a build could give it (C-151). */
@injectable()
export class LayoutGuess {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  css(guess: Guess, children: number): string {
    const sides = [guess.paddingTop, guess.paddingRight, guess.paddingBottom, guess.paddingLeft].map((side) =>
      this.#px(side ?? 0),
    );
    const [top = "", right = "", bottom = "", left = ""] = sides;
    const justified = GUESS_JUSTIFY[guess.primaryAxisAlignItems ?? HINT_FIGMA.min];
    const aligned = GUESS_ALIGN[guess.counterAxisAlignItems ?? HINT_FIGMA.min];
    const spaced =
      children >= 2 && (guess.itemSpacing ?? 0) > 0 && guess.primaryAxisAlignItems !== HINT_FIGMA.spaceBetween;

    return [
      GUESS_CSS.display,
      guess.layoutMode === HINT_FIGMA.vertical ? GUESS_CSS.column : null,
      sides.some((side) => side !== this.#px(0))
        ? HINT_LABEL.css(CSS_PROPERTY.padding, HINT_LABEL.box(top, right, bottom, left))
        : null,
      justified === undefined ? null : HINT_LABEL.css(CSS_PROPERTY.justifyContent, justified),
      aligned === undefined ? null : HINT_LABEL.css(CSS_PROPERTY.alignItems, aligned),
      spaced ? HINT_LABEL.css(CSS_PROPERTY.gap, this.#px(guess.itemSpacing ?? 0)) : null,
    ]
      .filter((part) => part !== null)
      .join(GUESS_CSS.separator);
  }

  #px(value: number): string {
    return HINT_LABEL.px(this.#format.round(value, PRECISION.spacing));
  }
}

export const LAYOUT_GUESS = new InjectionToken<LayoutGuess>("LayoutGuess");
