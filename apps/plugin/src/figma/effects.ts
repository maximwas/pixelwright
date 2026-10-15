import type { EffectSpec } from "@pixelwright/core";
import { documentColor } from "./color-profile.ts";

/** The effects CSS writes: shadows and plain blurs. */
export const CSS_EFFECTS: ReadonlySet<string> = new Set([
  "DROP_SHADOW",
  "INNER_SHADOW",
  "LAYER_BLUR",
  "BACKGROUND_BLUR",
]);

/**
 * The effects CSS wrote, each one the layer already has kept as it is (a shadow's colour variable, blend mode and
 * show-behind, a progressive blur of that radius), with what CSS cannot write and design_read never shows (noise,
 * texture, glass, hidden effects) kept where they were.
 */
export function mergedEffects(
  current: readonly Effect[],
  written: readonly Effect[],
  covered: ReadonlySet<string> = CSS_EFFECTS,
): Effect[] {
  const unused = current.filter((effect) => covered.has(effect.type) && (effect.visible ?? true));
  const merged = written.map((effect) => {
    const at = unused.findIndex((held) => effectKey(held) === effectKey(effect));

    return at === -1 ? effect : (unused.splice(at, 1)[0] as Effect);
  });

  // What CSS does not write stays where it was in the list.
  current.forEach((effect, index) => {
    if (!covered.has(effect.type) || !(effect.visible ?? true)) {
      merged.splice(Math.min(index, merged.length), 0, effect);
    }
  });

  return merged;
}

/** The parts of an effect CSS writes, rounded as it writes them: equal keys look the same in a read. */
export function effectKey(effect: Effect): string {
  const shadow = effect as Partial<DropShadowEffect>;
  const round = (value: number | undefined) => Math.round((value ?? 0) * 1_000);

  return JSON.stringify([
    effect.type,
    round((effect as { radius?: number }).radius),
    round(shadow.spread),
    round(shadow.offset?.x),
    round(shadow.offset?.y),
    shadow.color === undefined
      ? null
      : [shadow.color.r, shadow.color.g, shadow.color.b, shadow.color.a].map((channel) => Math.round(channel * 255)),
  ]);
}

/** Shadows and blurs as Figma holds them, in Figma's order. */
export function effectsOf(specs: readonly EffectSpec[]): Effect[] {
  return specs.map((effect): Effect => {
    if (!("color" in effect)) {
      return {
        type: effect.type,
        radius: effect.radius,
        visible: true,
        blurType: "NORMAL",
      };
    }

    return {
      type: effect.type,
      color: documentColor(effect.color),
      offset: {
        x: effect.x,
        y: effect.y,
      },
      radius: effect.radius,
      // Figma takes a spread only on boxes that clip their fill: a 0 is left out.
      ...(effect.spread === 0 ? {} : { spread: effect.spread }),
      visible: true,
      blendMode: "NORMAL",
    };
  });
}
