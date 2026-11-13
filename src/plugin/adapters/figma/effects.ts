import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EFFECT_MERGE } from "@/core/css/groups/effects/effect-merge.ts";
import { FIGMA_PAINT, PAINT_BLACK } from "@/plugin/adapters/figma/figma.constants.ts";
import { PAINTS, type TokenVariables } from "@/plugin/adapters/figma/paints.ts";
import { VARIABLE_COLOR } from "@/plugin/adapters/figma/variables/variable-color.ts";
import { INTENT_EFFECT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

export type EffectSpec = Extract<NonNullable<FigmaProps["effects"]>, readonly unknown[]>[number];

/**
 * Shadows and blurs as Figma holds them (C-103, FX-048), merged into a layer's list with core's EffectMerge: each one
 * held kept as it is, what CSS cannot write (noise, texture, glass, hidden effects) kept where it was. A shadow's
 * token binds its colour to the colour variable with setBoundVariableForEffect, the variable's alpha inside it.
 */
@injectable()
export class Effects {
  readonly #paints;
  readonly #colours;
  readonly #merge;

  constructor(
    paints = inject(PAINTS),
    colours = inject(VARIABLE_COLOR),
    merge = inject(EFFECT_MERGE),
  ) {
    this.#paints = paints;
    this.#colours = colours;
    this.#merge = merge;
  }

  /** `consumer` is the layer they go on: an effect style has none, its colour variables read in their default mode. */
  async merged(
    current: readonly Effect[],
    specs: readonly EffectSpec[],
    variables: TokenVariables,
    consumer?: SceneNode,
  ): Promise<Effect[]> {
    const written: Effect[] = [];

    for (const spec of specs) {
      written.push(await this.#effect(spec, variables, consumer));
    }

    return this.#merge.merged(current, written);
  }

  async #effect(
    spec: EffectSpec,
    variables: TokenVariables,
    consumer: SceneNode | undefined,
  ): Promise<Effect> {
    if (spec.type === INTENT_EFFECT.LAYER_BLUR || spec.type === INTENT_EFFECT.BACKGROUND_BLUR) {
      return { type: spec.type, radius: spec.radius, visible: true, blurType: FIGMA_PAINT.normal };
    }

    const shadow: DropShadowEffect | InnerShadowEffect = {
      type: spec.type,
      color: this.#paints.colour(spec.color ?? PAINT_BLACK),
      offset: { x: spec.x ?? 0, y: spec.y ?? 0 },
      radius: spec.radius,
      // Figma takes a spread only on boxes that clip their fill: a 0 is left out.
      ...(spec.spread === undefined || spec.spread === 0 ? {} : { spread: spec.spread }),
      visible: true,
      blendMode: FIGMA_PAINT.normal,
    };

    if (spec.token === undefined) {
      return shadow;
    }

    const variable = this.#paints.variable(spec.token, variables);
    const colour = await this.#colours.of(variable, consumer);

    return figma.variables.setBoundVariableForEffect(
      { ...shadow, color: colour ?? shadow.color },
      FIGMA_PAINT.colorField,
      variable,
    );
  }
}

export const EFFECTS = new InjectionToken<Effects>("Effects");
