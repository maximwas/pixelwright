import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_EASING_KEYWORDS, EASING, NAMED_CURVES } from "@/core/kernel/easing/easing.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

/** A Figma easing: a prototype transition's (a named curve, custom Bézier numbers, a spring) or a Motion keyframe's. */
export interface FigmaEasing {
  readonly type: string;
  readonly easingFunctionCubicBezier?:
    | { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
    | undefined;
  readonly bezier?: readonly number[] | undefined;
}

/**
 * The one easing writer (D-64, K-066): a keyword where CSS has one, else cubic-bezier() to 3 decimals; a hold as
 * step-end. Null for a spring (see EASING) or a type Figma does not have.
 */
@injectable()
export class EasingCss {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  css(easing: FigmaEasing): string | null {
    if (easing.type === EASING.hold) {
      return EASING.stepEnd;
    }

    const curve = this.#curve(easing);

    if (curve === null) {
      return null;
    }

    const numbers = curve.map((point) => String(this.#format.round(point, PRECISION.bezier))).join(EASING.separator);

    return CSS_EASING_KEYWORDS[numbers] ?? EASING.cubicBezier(numbers);
  }

  /** The easing's Bézier: its own numbers, else its named curve's. */
  #curve(easing: FigmaEasing): readonly number[] | null {
    const custom = easing.easingFunctionCubicBezier;

    if (custom !== undefined) {
      return [custom.x1, custom.y1, custom.x2, custom.y2];
    }

    return easing.bezier?.length === EASING.points ? easing.bezier : (NAMED_CURVES[easing.type] ?? null);
  }
}

export const EASING_CSS = new InjectionToken<EasingCss>("EasingCss");
