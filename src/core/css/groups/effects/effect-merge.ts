import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_EFFECTS, EFFECTS_WRITE } from "@/core/css/groups/effects/effects.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";

/** The parts of a Figma effect a merge compares; the rest of it (noise size, blend, show-behind) rides along. */
interface MergedEffect {
  readonly type: string;
  readonly visible?: boolean;
  readonly radius?: number;
  readonly spread?: number;
  readonly offset?: { readonly x: number; readonly y: number };
  readonly color?: { readonly r: number; readonly g: number; readonly b: number; readonly a?: number };
  readonly boundVariables?: unknown;
}

/**
 * The effects CSS wrote merged into a layer's list (O-015, C-103, 0.7.0's mergedEffects): each one the layer already
 * has kept as it is (a shadow's colour variable, blend mode and show-behind, a progressive blur), and what CSS cannot
 * name and design_read never shows (noise, texture, glass, hidden effects) kept where it was in the list. A shadow
 * written with a colour keeps a held one of that colour, its variable too; one written with a variable keeps only a
 * held one bound to it. The plugin's write merges with it.
 */
@injectable()
export class EffectMerge {
  readonly #names;

  constructor(names = inject(TOKEN_NAMES)) {
    this.#names = names;
  }

  merged<Effect extends MergedEffect>(current: readonly Effect[], written: readonly Effect[]): Effect[] {
    const unused = current.filter((effect) => this.#written(effect));
    const merged = written.map((effect) => {
      const bound = this.#variable(effect) !== undefined;
      const at = unused.findIndex((held) => this.#key(held, bound) === this.#key(effect, bound));

      return at === -1 ? effect : (unused.splice(at, 1)[0] ?? effect);
    });

    // What CSS does not write stays where it was in the list.
    current.forEach((effect, index) => {
      if (!this.#written(effect)) {
        merged.splice(Math.min(index, merged.length), 0, effect);
      }
    });

    return merged;
  }

  /** Whether CSS writes this effect: a visible shadow or plain blur. */
  #written(effect: MergedEffect): boolean {
    return Object.hasOwn(CSS_EFFECTS, effect.type) && (effect.visible ?? true);
  }

  /** What CSS writes of an effect, rounded, and the variable its colour is bound to (unless `binding` is false). */
  #key(effect: MergedEffect, binding: boolean): string {
    const round = (value: number | undefined) => Math.round((value ?? 0) * EFFECTS_WRITE.keyScale);
    const { color } = effect;

    return JSON.stringify([
      effect.type,
      round(effect.radius),
      round(effect.spread),
      round(effect.offset?.x),
      round(effect.offset?.y),
      color === undefined
        ? null
        : [color.r, color.g, color.b, color.a ?? 1].map((channel) => Math.round(channel * EFFECTS_WRITE.byte)),
      binding ? (this.#variable(effect) ?? null) : null,
    ]);
  }

  #variable(effect: MergedEffect): string | undefined {
    return this.#names.alias(effect.boundVariables, EFFECTS_WRITE.boundColor);
  }
}

export const EFFECT_MERGE = new InjectionToken<EffectMerge>("EffectMerge");
