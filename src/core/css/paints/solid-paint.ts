import { InjectionToken, injectable } from "@needle-di/core";
import {
  FIGMA_PAINT,
  PAINTS_NUMBER,
  PAINTS_PATTERN,
  PAINTS_TEXT,
  PAINTS_VALUE,
} from "@/core/css/paints/paints.constants.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { type Channels, Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

export type Paint = NonNullable<ReadLayer["strokes"]>[number];

type Variable = ReadModel["variables"][string];

/**
 * A solid paint as CSS (C-020, C-088): the token of the colour variable bound to it, else its colour in the file's
 * space, faded by the paint's opacity. Figma keeps a bound paint's opacity as the whole of it: the variable's alpha
 * when bound (seen live on 2026-10-17), less when lowered after; only what is past the variable's alpha is a mix.
 */
@injectable()
export class SolidPaint {
  /** The paint's CSS; null when it is no solid with a colour. */
  css(paint: Paint, model: ReadModel): string | null {
    if (paint.type !== FIGMA_PAINT.solid || paint.color === undefined) {
      return null;
    }

    const opacity = paint.opacity ?? 1;
    const space = this.#space(model);
    const variable = this.#variable(paint, model);

    if (variable === undefined) {
      return Color.of(paint.color, space).faded(opacity).css();
    }

    const name = this.#variableToken(variable);
    const alpha = this.#isChannels(variable.value) ? (variable.value.a ?? 1) : 1;
    const percent = Math.round((alpha > 0 ? opacity / alpha : opacity) * PAINTS_NUMBER.percent);

    return percent < PAINTS_NUMBER.percent ? PAINTS_TEXT.mix(space, name, percent) : PAINTS_TEXT.token(name);
  }

  /**
   * A style's or variable's custom property named as Dev Mode names it: `a/b c` is `--a-b-c`.
   * shortcut: no hash for a name without letters and no -2 for a duplicate style; item 20's References name tokens.
   */
  token(name: string): string {
    return PAINTS_TEXT.property(
      name
        .trim()
        .replace(PAINTS_PATTERN.unnamed, PAINTS_VALUE.dash)
        .replace(PAINTS_PATTERN.edgeDashes, PAINTS_VALUE.none),
    );
  }

  /** The variable an alias `{ type: "VARIABLE_ALIAS", id }` on the paint's colour points at, when the read holds it. */
  #variable(paint: Paint, model: ReadModel): Variable | undefined {
    const alias = paint.boundVariables?.color;

    return typeof alias === "object" && alias !== null && "id" in alias && typeof alias.id === "string"
      ? model.variables[alias.id]
      : undefined;
  }

  /** The WEB code syntax its designer gave the variable, else its name. */
  #variableToken(variable: Variable): string {
    const web = variable.codeSyntax?.WEB?.trim() ?? PAINTS_VALUE.none;

    if (web === PAINTS_VALUE.none) {
      return this.token(variable.name);
    }

    return (
      PAINTS_PATTERN.wrapped.exec(web)?.[1] ?? (web.startsWith(PAINTS_VALUE.prefix) ? web : PAINTS_TEXT.property(web))
    );
  }

  #isChannels(value: unknown): value is Channels {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }

  /** Display P3 in a DISPLAY_P3 file; sRGB in LEGACY and SRGB ones, or when the read does not say. */
  #space(model: ReadModel): ColorSpace {
    return model.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb;
  }
}

export const SOLID_PAINT = new InjectionToken<SolidPaint>("SolidPaint");
