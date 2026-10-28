import type { EffectSpec } from "@pixelwright/core";
import { documentColor } from "./color-profile.ts";
import type { PaintSources } from "./paints.ts";
import type { TokenIndex } from "./tokens/token-index.ts";
import { variableColor } from "./variable-color.ts";

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
 * texture, glass, hidden effects) kept where they were. A shadow written with a colour keeps a held one of that
 * colour, its variable too; one written with a variable keeps only a held one bound to it.
 */
export function mergedEffects(
  current: readonly Effect[],
  written: readonly Effect[],
  covered: ReadonlySet<string> = CSS_EFFECTS,
): Effect[] {
  const unused = current.filter((effect) => covered.has(effect.type) && (effect.visible ?? true));
  const merged = written.map((effect) => {
    const bound = colorVariable(effect) !== null;
    const at = unused.findIndex((held) => effectKey(held, bound) === effectKey(effect, bound));

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

/**
 * The parts of an effect CSS writes, rounded as it writes them, and the variable its colour is bound to (unless
 * `binding` is false): equal keys look the same in a read.
 */
export function effectKey(effect: Effect, binding = true): string {
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
    binding ? colorVariable(effect) : null,
  ]);
}

/**
 * Shadows and blurs as Figma holds them, in Figma's order. A shadow's token binds its colour to the colour variable
 * (a library's imported), in the variable's colour for `consumer`, the layer it goes on.
 */
export async function effectsOf(
  specs: readonly EffectSpec[],
  sources: Pick<PaintSources, "tokens">,
  consumer?: SceneNode,
): Promise<Effect[]> {
  const effects: Effect[] = [];

  for (const spec of specs) {
    effects.push(await effectOf(spec, sources, consumer));
  }

  return effects;
}

/** Finds each shadow's colour variable without importing it (a dry run's check); whether the effects name any. */
export async function checkEffects(specs: readonly EffectSpec[], index: TokenIndex): Promise<boolean> {
  const tokens = specs.flatMap((spec) => ("token" in spec && spec.token !== undefined ? [spec.token] : []));

  for (const token of tokens) {
    await index.find(token, "COLOR");
  }

  return tokens.length > 0;
}

async function effectOf(
  effect: EffectSpec,
  sources: Pick<PaintSources, "tokens">,
  consumer: SceneNode | undefined,
): Promise<Effect> {
  if (!("color" in effect)) {
    return {
      type: effect.type,
      radius: effect.radius,
      visible: true,
      blurType: "NORMAL",
    };
  }

  const shadow: DropShadowEffect | InnerShadowEffect = {
    type: effect.type,
    color: documentColor(
      effect.color ?? {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      },
    ),
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

  if (effect.token === undefined) {
    return shadow;
  }

  const index = await sources.tokens();
  const variable = await index.variable(effect.token, "COLOR");
  const color = await variableColor(variable, consumer, index.lookup);

  return figma.variables.setBoundVariableForEffect(
    {
      ...shadow,
      color: color ?? shadow.color,
    },
    "color",
    variable,
  );
}

/** The id of the variable an effect's colour is bound to, or null. */
function colorVariable(effect: Effect): string | null {
  return (effect as { boundVariables?: { color?: VariableAlias } }).boundVariables?.color?.id ?? null;
}
