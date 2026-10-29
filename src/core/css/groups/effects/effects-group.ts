import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  BLURS,
  EFFECTS_ATTRIBUTES,
  EFFECTS_NUMBER,
  EFFECTS_SOURCES,
  EFFECTS_TEXT,
  EFFECTS_VALUE,
  FIGMA_EFFECT,
  PROGRESSIVE_ENDS,
  RENDERED_EFFECTS,
} from "@/core/css/groups/effects/effects.constants.ts";
import { TEXT_TYPES } from "@/core/css/groups/paint/paint.constants.ts";
import { PAINTS_TEXT } from "@/core/css/paints/paints.constants.ts";
import { SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Effect = NonNullable<ReadLayer["effects"]>[number];

/**
 * A layer's visible effects (C-100..C-102): shadows top first as box-shadow or a text's text-shadow, an effect style's
 * as its token; blurs as filter and backdrop-filter at 0.43 R, a progressive one's end radius with a note; effects
 * CSS has no property for as a note.
 */
@injectable()
export class EffectsGroup implements PropertyGroup {
  readonly attributes = EFFECTS_ATTRIBUTES;
  readonly sources = EFFECTS_SOURCES;
  readonly #solid;
  readonly #lengths;
  readonly #format;
  readonly #names;

  constructor(
    solid = inject(SOLID_PAINT),
    lengths = inject(CSS_LENGTH),
    format = inject(NUMBER_FORMAT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#solid = solid;
    this.#lengths = lengths;
    this.#format = format;
    this.#names = names;
  }

  read({ layer, model, css }: CssScope): void {
    const effects = (layer.effects ?? []).filter((effect) => effect.visible ?? true);

    this.#shadows(layer, effects, model, css);

    for (const effect of effects) {
      const blur = BLURS[effect.type];

      if (blur !== undefined) {
        css.set(blur.property, EFFECTS_TEXT.blur(this.#blur(effect.radius ?? 0)));
        this.#progressive(effect, blur.note, css);
      } else if (RENDERED_EFFECTS[effect.type] ?? false) {
        css.note(EFFECTS_VALUE.effect, EFFECTS_TEXT.rendered(effect.type));
      }
    }
  }

  /**
   * The visible shadows top first, as CSS lists them (Figma keeps them bottom first, FX-058): box-shadow's with inner
   * ones inset, or a text's text-shadow, which has no inner shadow or spread; empty when there are none.
   */
  shadows(
    effects: readonly Effect[],
    isText: boolean,
    model: ReadModel,
  ): string {
    return effects
      .filter(
        (effect) =>
          (effect.visible ?? true) &&
          (effect.type === FIGMA_EFFECT.dropShadow || (effect.type === FIGMA_EFFECT.innerShadow && !isText)),
      )
      .reverse()
      .map((effect) => this.#shadow(effect, isText, model))
      .join(EFFECTS_VALUE.joint);
  }

  /** The layer's shadows; an effect style's are its token (T-163). */
  #shadows(
    layer: ReadLayer,
    effects: readonly Effect[],
    model: ReadModel,
    css: CssDeclarations,
  ): void {
    const isText = TEXT_TYPES[layer.type] ?? false;
    const shadows = this.shadows(effects, isText, model);

    if (shadows === "") {
      return;
    }

    const style = layer.effectStyleId === undefined ? undefined : model.styles[layer.effectStyleId];

    css.set(
      isText ? CSS_PROPERTY.textShadow : CSS_PROPERTY.boxShadow,
      style === undefined ? shadows : PAINTS_TEXT.token(this.#names.style(style)),
    );
  }

  /** `[inset] x y blur [spread] colour`, the colour its variable's token when bound. */
  #shadow(
    effect: Effect,
    isText: boolean,
    model: ReadModel,
  ): string {
    return [
      effect.type === FIGMA_EFFECT.innerShadow ? EFFECTS_VALUE.inset : null,
      this.#lengths.px(effect.offset?.x ?? 0),
      this.#lengths.px(effect.offset?.y ?? 0),
      this.#lengths.px(effect.radius ?? 0),
      isText ? null : this.#lengths.px(effect.spread ?? 0),
      effect.color === undefined ? null : this.#solid.color(effect.color, effect.boundVariables, 1, model),
    ]
      .filter((part) => part !== null)
      .join(EFFECTS_VALUE.space);
  }

  /** CSS's blur length for Figma's radius: 0.43 R to two decimals, a bare 0 (C-100). */
  #blur(radius: number): string {
    const length = this.#radius(radius);

    return length === 0 ? EFFECTS_VALUE.zero : EFFECTS_TEXT.px(length);
  }

  /** A progressive blur's run, in CSS radii, from where it starts to where it ends (percents of the box, C-102). */
  #progressive(
    effect: Effect,
    note: string,
    css: CssDeclarations,
  ): void {
    if (effect.blurType !== FIGMA_EFFECT.progressive) {
      return;
    }

    const at = ({ x, y }: { readonly x: number; readonly y: number }) =>
      EFFECTS_TEXT.at(Math.round(x * EFFECTS_NUMBER.percent), Math.round(y * EFFECTS_NUMBER.percent));

    css.note(
      note,
      EFFECTS_TEXT.progressive(
        EFFECTS_TEXT.px(this.#radius(effect.startRadius ?? 0)),
        at(effect.startOffset ?? PROGRESSIVE_ENDS.start),
        EFFECTS_TEXT.px(this.#radius(effect.radius ?? 0)),
        at(effect.endOffset ?? PROGRESSIVE_ENDS.end),
      ),
    );
  }

  #radius(radius: number): number {
    return this.#format.round(radius * EFFECTS_NUMBER.blurPerRadius, PRECISION.blur);
  }
}

export const EFFECTS_GROUP = new InjectionToken<EffectsGroup>("EffectsGroup");
