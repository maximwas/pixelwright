import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  BLUR_WRITES,
  EFFECTS_ATTRIBUTES,
  EFFECTS_ERROR,
  EFFECTS_NUMBER,
  EFFECTS_PATTERN,
  EFFECTS_VALUE,
  EFFECTS_WRITE,
} from "@/core/css/groups/effects/effects.constants.ts";
import { PAINT_VALUE } from "@/core/css/paints/paint-value.ts";
import { PAINTS_NUMBER } from "@/core/css/paints/paints.constants.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import type { ColorValue } from "@/core/kernel/color/color.ts";
import { INTENT_EFFECT, INTENT_KEY, INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type EffectSpec = Extract<NonNullable<FigmaProps["effects"]>, readonly unknown[]>[number];

/** A shadow's colour: a colour, or a colour variable's token (no colour). */
interface ShadowColor {
  readonly color: ColorValue | null;
  readonly token?: string;
}

/**
 * Shadows and blurs written back as the one list Figma keeps them in (C-103..C-106): an attribute the element leaves
 * out keeps what the layer has, so a new blur keeps the shadows. An effect style holds every effect: a var() on the
 * shadows or a blur binds it, and another effect beside it is an error.
 */
@injectable()
export class EffectsWriter implements PropertyWriter {
  readonly attributes = EFFECTS_ATTRIBUTES;
  readonly #paints;
  readonly #lengths;
  readonly #split;
  readonly #vars;

  constructor(
    paints = inject(PAINT_VALUE),
    lengths = inject(CSS_LENGTH),
    split = inject(CSS_SPLIT),
    vars = inject(CSS_VAR),
  ) {
    this.#paints = paints;
    this.#lengths = lengths;
    this.#split = split;
    this.#vars = vars;
  }

  write(input: WriteInput, out: WriteOutput): void {
    const { merged, changed } = input;
    const shadowAttribute =
      merged(CSS_PROPERTY.boxShadow) === undefined ? CSS_PROPERTY.textShadow : CSS_PROPERTY.boxShadow;

    if (this.#boundStyle(shadowAttribute, input, out)) {
      return;
    }

    const blurs = this.#blurs(input, out);
    const shadows = blurs === null ? null : this.#shadows(shadowAttribute, merged(shadowAttribute), out);

    if (blurs !== null && shadows !== null) {
      out.set(
        INTENT_KEY.effects,
        [...blurs, ...shadows.reverse()],
        EFFECTS_ATTRIBUTES.find(changed) ?? shadowAttribute,
      );
    }
  }

  /**
   * The effect style a var() on the shadows or a blur names, the element's own before the layer's, set as the layer's
   * effects; false when none names one.
   */
  #boundStyle(
    shadowAttribute: string,
    { own, merged, changed }: WriteInput,
    out: WriteOutput,
  ): boolean {
    const attributes = [shadowAttribute, ...BLUR_WRITES.map(([name]) => name)];
    const tokenIn = (name: string) => this.#vars.token(merged(name) ?? "");
    const styled =
      attributes.find((name) => changed(name) && tokenIn(name) !== null) ??
      attributes.find((name) => tokenIn(name) !== null);
    const token = styled === undefined ? null : tokenIn(styled);

    if (styled === undefined || token === null) {
      return false;
    }

    const beside = attributes.filter(
      (name) =>
        name !== styled &&
        changed(name) &&
        own(name)?.trim() !== EFFECTS_WRITE.none &&
        tokenIn(name)?.token !== token.token,
    );

    for (const name of beside) {
      out.fail(name, EFFECTS_ERROR.holdsEvery(token.token, styled === shadowAttribute));
    }

    out.set(INTENT_KEY.effects, { token: token.token }, styled);

    return true;
  }

  /** The blurs the filters give (Figma's radius is CSS's over 0.43); null after a filter not blur(Npx). */
  #blurs({ merged }: WriteInput, out: WriteOutput): EffectSpec[] | null {
    const effects: EffectSpec[] = [];

    for (const [attribute, type] of BLUR_WRITES) {
      const value = merged(attribute)?.trim();

      if (value === undefined || value === EFFECTS_WRITE.none) {
        continue;
      }

      const blur = EFFECTS_PATTERN.blur.exec(value);

      if (blur === null) {
        out.fail(attribute, EFFECTS_ERROR.notBlur(attribute, value));

        return null;
      }

      const radius = Number(blur[1]) / EFFECTS_NUMBER.blurPerRadius;

      effects.push({ type, radius: Math.round(radius * EFFECTS_WRITE.radiusScale) / EFFECTS_WRITE.radiusScale });
    }

    return effects;
  }

  /** The shadows of a box-shadow or text-shadow list, top first as CSS lists them; null after one that is no shadow. */
  #shadows(
    attribute: string,
    shadows: string | undefined,
    out: WriteOutput,
  ): EffectSpec[] | null {
    const list: EffectSpec[] = [];
    const given = shadows === undefined || shadows.trim() === EFFECTS_WRITE.none ? "" : shadows;

    for (const shadow of given === "" ? [] : this.#split.split(given, CSS_SEPARATOR.comma)) {
      const words = this.#split.split(shadow, CSS_SEPARATOR.space);
      const isLength = (word: string) => typeof this.#lengths.length(word) === "number";
      const lengths = words.filter(isLength).map(Number.parseFloat);
      const color = this.#color(
        words.filter((word) => word !== EFFECTS_VALUE.inset && !isLength(word)).join(CSS_SEPARATOR.space),
      );

      if (
        lengths.length < EFFECTS_WRITE.minLengths ||
        lengths.length > EFFECTS_WRITE.maxLengths ||
        color === null ||
        typeof color === "string"
      ) {
        out.fail(attribute, typeof color === "string" ? color : EFFECTS_ERROR.notShadow(shadow));

        return null;
      }

      const [x = 0, y = 0, radius = 0, spread = 0] = lengths;
      const type = words.includes(EFFECTS_VALUE.inset) ? INTENT_EFFECT.INNER_SHADOW : INTENT_EFFECT.DROP_SHADOW;

      list.push({ type, ...color, x, y, radius, spread });
    }

    return list;
  }

  /**
   * A shadow's colour, read as a background's: a colour, or a colour variable's token; why not, when a token is faded
   * (Figma's shadow takes its variable's whole colour, FX-048); null when it is none.
   */
  #color(value: string): ShadowColor | string | null {
    const paint = this.#paints.of(value);

    if (paint?.kind === INTENT_PAINT.color && paint.color !== undefined) {
      return { color: paint.color };
    }

    if (paint?.kind !== INTENT_PAINT.token || paint.token === undefined) {
      return null;
    }

    return paint.opacity === PAINTS_NUMBER.whole
      ? { color: null, token: paint.token }
      : EFFECTS_ERROR.shareOfVariable(paint.token);
  }
}
