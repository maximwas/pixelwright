import { InjectionToken, injectable } from "@needle-di/core";
import { FONT_WEIGHT_NAMES, FONT_WEIGHT_NUMBER } from "@/core/kernel/names/names.constants.ts";

/**
 * A font weight guessed from its style's name (K-074): Thin 100 … Black 900, Regular 400 when the name says none. A
 * GUESS: a text style keeps a font name, not a weight, and a variable font's real weight can differ. The font
 * shorthand and the DTCG typography tokens both take it.
 */
@injectable()
export class FontWeight {
  guess(style: string): number {
    return FONT_WEIGHT_NAMES.find(([pattern]) => pattern.test(style))?.[1] ?? FONT_WEIGHT_NUMBER.regular;
  }
}

export const FONT_WEIGHT = new InjectionToken<FontWeight>("FontWeight");
