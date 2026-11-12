import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
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
    const faded = this.#vars.fade(value);

    if (faded?.color) {
      return { kind: INTENT_PAINT.color, color: faded.color.faded(faded.share).value() };
    }

    return faded?.token ? { kind: INTENT_PAINT.token, token: faded.token, opacity: faded.share } : null;
  }
}

export const PAINT_VALUE = new InjectionToken<PaintValue>("PaintValue");
