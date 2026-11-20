import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GRADIENT_GEOMETRY } from "@/core/css/gradients/gradient-geometry.ts";
import type { GradientSpec } from "@/core/css/gradients/gradients.types.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { Color, type ColorValue } from "@/core/kernel/color/color.ts";
import { FIGMA_PAINT, PAINT_BLACK, PAINT_NUMBER, PAINTS_TEXT } from "@/plugin/adapters/figma/figma.constants.ts";
import { VARIABLE_COLOR } from "@/plugin/adapters/figma/variables/variable-color.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type PaintSpec = NonNullable<FigmaProps["fills"]>[number];

type StopSpec = NonNullable<PaintSpec["stops"]>[number];

/** The colour variables a list's tokens name, by token: the step finds them in the call's token index first. */
export type TokenVariables = ReadonlyMap<string, Variable>;

/**
 * Paints as Figma takes them (P-092): colours in the document's colour space, colour variables bound with
 * setBoundVariableForPaint, gradients drawn at the layer's size with their stops' variables; and the rules that tell
 * a held list from a changed one and set a bound paint's opacity again.
 */
@injectable()
export class Paints {
  readonly #colours;
  readonly #geometry;

  constructor(colours = inject(VARIABLE_COLOR), geometry = inject(GRADIENT_GEOMETRY)) {
    this.#colours = colours;
    this.#geometry = geometry;
  }

  /**
   * The layers of a list in Figma's order; `consumer` is the layer they go on (its mode, its size; none for a paint
   * style, drawn in a unit square), `images` the hashes of the images the list's files made, by their upload's stream.
   */
  async of(
    specs: readonly PaintSpec[],
    variables: TokenVariables,
    consumer?: SceneNode,
    images: ReadonlyMap<string, string> = new Map(),
  ): Promise<Paint[]> {
    const paints: Paint[] = [];

    for (const spec of specs) {
      paints.push(await this.#paint(spec, variables, consumer, images));
    }

    return paints;
  }

  /** A wire colour in the document's space (K-064): a Display P3 file holds P3 channels. */
  colour(value: ColorValue): RGBA {
    const space = figma.root.documentColorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb;

    return Color.of(value, value.space ?? COLOR_SPACE.srgb)
      .to(space)
      .channels();
  }

  /** The variable a token names, looked up by the step before the paints were made. */
  variable(token: string, variables: TokenVariables): Variable {
    const variable = variables.get(token);

    if (variable === undefined) {
      throw new WriteError(PAINTS_TEXT.unresolved(token));
    }

    return variable;
  }

  /**
   * A solid paint bound to a colour variable (FX-046): built from the variable's colour for the layer first, since
   * binding a bare paint leaves a black placeholder, at the variable's alpha times `opacity`.
   */
  async bound(
    variable: Variable,
    opacity: number,
    consumer?: SceneNode,
  ): Promise<SolidPaint> {
    const colour = (await this.#colours.of(variable, consumer)) ?? PAINT_BLACK;

    return figma.variables.setBoundVariableForPaint(
      { type: FIGMA_PAINT.solid, color: { r: colour.r, g: colour.g, b: colour.b }, opacity: colour.a * opacity },
      FIGMA_PAINT.colorField,
      variable,
    );
  }

  /**
   * The paints to set again after Figma took them (FX-046, B-048): it gives a newly bound paint its variable's alpha
   * as opacity, whatever it was given, and keeps a lowered one on a paint already bound. Null when every bound paint
   * holds the opacity wanted: a bound paint's opacity is never reset to 1 behind its back.
   */
  again(live: readonly Paint[], wanted: readonly Paint[]): Paint[] | null {
    const off = wanted.some(
      (paint, index) =>
        this.#bound(paint) && Math.abs(this.#opacity(live[index]) - this.#opacity(paint)) > PAINT_NUMBER.epsilon,
    );

    return off
      ? live.map((paint, index) =>
        this.#bound(paint) && this.#bound(wanted[index])
          ? { ...paint, opacity: this.#opacity(wanted[index]) }
          : paint,
      )
      : null;
  }

  /** Whether a layer's paints already look as these do, to 4 decimals (P-080: the same paints are not set again). */
  same(live: unknown, wanted: readonly Paint[]): boolean {
    return (
      Array.isArray(live) &&
      live.length === wanted.length &&
      wanted.every((paint, index) => this.#key(live[index] as Paint) === this.#key(paint))
    );
  }

  async #paint(
    spec: PaintSpec,
    variables: TokenVariables,
    consumer: SceneNode | undefined,
    images: ReadonlyMap<string, string>,
  ): Promise<Paint> {
    if (spec.kind === INTENT_PAINT.color) {
      const { r, g, b, a } = this.colour(spec.color ?? PAINT_BLACK);

      return { type: FIGMA_PAINT.solid, color: { r, g, b }, opacity: a * (spec.opacity ?? 1) };
    }

    if (spec.kind === INTENT_PAINT.token && spec.token !== undefined) {
      return await this.bound(this.variable(spec.token, variables), spec.opacity ?? 1, consumer);
    }

    if (spec.kind === INTENT_PAINT.gradient) {
      return await this.#gradient(spec, variables, consumer);
    }

    const imageHash = images.get(spec.stream ?? "");

    if (spec.kind === INTENT_PAINT.image && imageHash !== undefined) {
      return { type: FIGMA_PAINT.image, imageHash, scaleMode: spec.scaleMode ?? FIGMA_PAINT.fill };
    }

    throw new WriteError(PAINTS_TEXT.image);
  }

  /** A gradient drawn from its CSS at the layer's size (FX-020), its stops in the document's space or bound. */
  async #gradient(
    spec: PaintSpec,
    variables: TokenVariables,
    consumer: SceneNode | undefined,
  ): Promise<GradientPaint> {
    const box = (consumer ?? {}) as Partial<LayoutMixin>;
    const stops: ColorStop[] = [];

    for (const stop of spec.stops ?? []) {
      stops.push(await this.#stop(stop, variables, consumer));
    }

    return {
      type: FIGMA_PAINT.gradient(spec.type ?? "") as GradientPaint["type"],
      gradientTransform: this.#geometry.transform(spec as GradientSpec, {
        width: box.width || PAINT_NUMBER.unitSide,
        height: box.height || PAINT_NUMBER.unitSide,
      }) as Transform,
      gradientStops: stops,
    };
  }

  /** A stop: a colour, or bound to its colour variable at the variable's alpha (FX-047), faded by color-mix(). */
  async #stop(
    { position, color, token, opacity }: StopSpec,
    variables: TokenVariables,
    consumer: SceneNode | undefined,
  ): Promise<ColorStop> {
    if (token === undefined) {
      return { position, color: this.colour(color ?? PAINT_BLACK) };
    }

    const variable = this.variable(token, variables);
    const colour = (await this.#colours.of(variable, consumer)) ?? PAINT_BLACK;

    return {
      position,
      color: { r: colour.r, g: colour.g, b: colour.b, a: colour.a * (opacity ?? 1) },
      boundVariables: { color: figma.variables.createVariableAlias(variable) },
    };
  }

  #bound(paint: Paint | undefined): boolean {
    return paint?.type === FIGMA_PAINT.solid && paint.boundVariables?.color !== undefined;
  }

  #opacity(paint: Paint | undefined): number {
    return paint?.opacity ?? 1;
  }

  /** The parts of a paint that make it look as it does, rounded: an image's and a gradient's too. */
  #key(paint: Paint | undefined): string {
    const round = (value: number | undefined) => Math.round((value ?? 0) * PAINT_NUMBER.keyScale);
    const solid = paint as Partial<SolidPaint> | undefined;
    const image = paint as Partial<ImagePaint> | undefined;
    const gradient = paint as Partial<GradientPaint> | undefined;

    return JSON.stringify([
      paint?.type,
      paint?.visible ?? true,
      round(paint?.opacity ?? 1),
      solid?.color === undefined ? null : [round(solid.color.r), round(solid.color.g), round(solid.color.b)],
      solid?.boundVariables?.color?.id ?? null,
      image?.imageHash ?? null,
      image?.scaleMode ?? null,
      gradient?.gradientTransform?.flat().map(round) ?? null,
      gradient?.gradientStops?.map((stop) => [
        round(stop.position),
        round(stop.color.r),
        round(stop.color.g),
        round(stop.color.b),
        round(stop.color.a),
        stop.boundVariables?.color?.id ?? null,
      ]) ?? null,
    ]);
  }
}

export const PAINTS = new InjectionToken<Paints>("Paints");
