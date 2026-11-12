import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_PAINT, PAINTS_NUMBER, PAINTS_TEXT, PAINTS_VALUE } from "@/core/css/paints/paints.constants.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { type Channels, Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ModelTables, ReadModel } from "@/shared/read-model/read-model.schema.ts";

export type Paint = NonNullable<ReadLayer["strokes"]>[number];

type Variable = ReadModel["variables"][string];

/**
 * A solid paint as CSS (C-020, C-088): the token of the colour variable bound to it, else its colour in the file's
 * space, faded by the paint's opacity. Figma keeps a bound paint's opacity as the whole of it: the variable's alpha
 * when bound (seen live on 2026-10-17), less when lowered after; only what is past the variable's alpha is a mix.
 */
@injectable()
export class SolidPaint {
  readonly #names;

  constructor(names = inject(TOKEN_NAMES)) {
    this.#names = names;
  }

  /** The paint's CSS; null when it is no solid with a colour. */
  css(paint: Paint, model: ModelTables): string | null {
    if (paint.type !== FIGMA_PAINT.solid || paint.color === undefined) {
      return null;
    }

    const opacity = paint.opacity ?? 1;
    const variable = this.#variable(paint.boundVariables, model);
    const alpha = variable !== undefined && this.#isChannels(variable.value) ? (variable.value.a ?? 1) : 1;

    return this.color(paint.color, paint.boundVariables, alpha > 0 ? opacity / alpha : opacity, model);
  }

  /**
   * A colour as CSS (a solid's, a gradient stop's, FX-047, a shadow's, C-101): the token of the colour variable its
   * bound variables name, mixed with transparent below an opacity of 100%; else the colour faded by the opacity.
   */
  color(
    color: Channels,
    bound: unknown,
    opacity: number,
    model: ModelTables,
  ): string {
    const space = this.#space(model);
    const variable = this.#variable(bound, model);

    if (variable === undefined) {
      return Color.of(color, space).faded(opacity).css();
    }

    const name = this.#names.variable(variable);
    const percent = Math.round(opacity * PAINTS_NUMBER.percent);

    return percent < PAINTS_NUMBER.percent ? PAINTS_TEXT.mix(space, name, percent) : PAINTS_TEXT.token(name);
  }

  /** The variable an alias `{ type: "VARIABLE_ALIAS", id }` on the bound colour points at, when the read holds it. */
  #variable(bound: unknown, model: ModelTables): Variable | undefined {
    const id = this.#names.alias(bound, PAINTS_VALUE.boundColor);

    return id === undefined ? undefined : model.variables[id];
  }

  #isChannels(value: unknown): value is Channels {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }

  /** Display P3 in a DISPLAY_P3 file; sRGB in LEGACY and SRGB ones, or when the read does not say. */
  #space(model: ModelTables): ColorSpace {
    return model.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb;
  }
}

export const SOLID_PAINT = new InjectionToken<SolidPaint>("SolidPaint");
