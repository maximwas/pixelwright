import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GRADIENT_PATTERN } from "@/core/css/gradients/gradients.constants.ts";
import { PAINTS_NUMBER } from "@/core/css/paints/paints.constants.ts";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
import { Color } from "@/core/kernel/color/color.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** One paint as the plugin takes it: a colour, a token at an opacity, a gradient or an image file. */
export type PaintSpec = NonNullable<FigmaProps["fills"]>[number];

/**
 * A paint CSS writes as one value (C-081, C-091, C-105): a colour, a token, or either faded by
 * `color-mix(in <space>, … N%, transparent)` as design_read writes a paint's opacity.
 */
@injectable()
export class PaintValue {
  readonly #vars;

  constructor(vars = inject(CSS_VAR)) {
    this.#vars = vars;
  }

  /** The paint; null for anything that is no colour or token. */
  of(value: string): PaintSpec | null {
    const mix = GRADIENT_PATTERN.mix.exec(value.trim());
    const share = mix === null ? PAINTS_NUMBER.whole : Number(mix[2]) / PAINTS_NUMBER.percent;
    const inner = mix?.[1] ?? value;
    const token = this.#vars.token(inner);

    if (token !== null) {
      return { kind: INTENT_PAINT.token, token: token.token, opacity: share };
    }

    const color = Color.parse(inner.trim());

    return color === null ? null : { kind: INTENT_PAINT.color, color: color.faded(share).value() };
  }
}

export const PAINT_VALUE = new InjectionToken<PaintValue>("PaintValue");
