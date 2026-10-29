import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GRADIENT_GEOMETRY } from "@/core/css/gradients/gradient-geometry.ts";
import {
  FIGMA_GRADIENT,
  GRADIENT_KIND,
  GRADIENT_NUMBER,
  GRADIENT_TEXT,
  GRADIENT_VALUE,
} from "@/core/css/gradients/gradients.constants.ts";
import type { Box, GradientTransform } from "@/core/css/gradients/gradients.types.ts";
import { type Paint, SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Stop = NonNullable<Paint["gradientStops"]>[number];

/**
 * A gradient paint as CSS on the box it fills (C-083..C-085, C-087): linear-gradient (its angle and stops along CSS's
 * gradient line), radial-gradient (an axis-aligned ellipse's radii and centre), conic-gradient (its start and centre).
 * The paint's opacity goes into its stops; a stop bound to a colour variable is its token.
 */
@injectable()
export class GradientCss {
  readonly #geometry;
  readonly #solid;
  readonly #lengths;
  readonly #format;

  constructor(
    geometry = inject(GRADIENT_GEOMETRY),
    solid = inject(SOLID_PAINT),
    lengths = inject(CSS_LENGTH),
    format = inject(NUMBER_FORMAT),
  ) {
    this.#geometry = geometry;
    this.#solid = solid;
    this.#lengths = lengths;
    this.#format = format;
  }

  /** The paint's CSS; null for what CSS cannot draw: a diamond, a turned ellipse, a flat transform, no stops. */
  css(
    paint: Paint,
    box: Box,
    model: ReadModel,
  ): string | null {
    const kind = FIGMA_GRADIENT[paint.type];
    const transform = this.#transform(paint.gradientTransform);
    const stops = paint.gradientStops ?? [];

    if (kind === undefined || transform === null || stops.length === 0) {
      return null;
    }

    const list = (place: (position: number) => number) =>
      stops
        .map((stop) => GRADIENT_TEXT.stop(this.#color(stop, paint, model), this.#decimal(place(stop.position) * 100)))
        .join(GRADIENT_VALUE.joint);

    if (kind === GRADIENT_KIND.linear) {
      return this.#linear(transform, box, list);
    }

    const written = list((position) => position);

    if (kind === GRADIENT_KIND.angular) {
      return this.#conic(transform, box, written);
    }

    const shape = this.#ellipse(transform, box);

    return shape === null ? null : GRADIENT_TEXT.radial(shape, written);
  }

  /** The angle, and each Figma stop's place moved to its place along CSS's line through the centre to far corners. */
  #linear(
    [[xx, xy, xt]]: GradientTransform,
    box: Box,
    list: (place: (position: number) => number) => string,
  ): string | null {
    const [gx, gy] = [xx / box.width, xy / box.height];

    if (!Number.isFinite(gx) || !Number.isFinite(gy) || (gx === 0 && gy === 0)) {
      return null;
    }

    const angle = this.#geometry.angle(gx, gy);
    const span = Math.hypot(gx, gy) * this.#geometry.lineLength(angle, box);
    const middle = (xx + xy) / 2 + xt;

    return GRADIENT_TEXT.linear(
      this.#decimal(angle),
      list((position) => (position - middle) / span + GRADIENT_NUMBER.half),
    );
  }

  /** An ellipse's radii and centre, `120px 40px at 30% 60%`; null for a turned or skewed one (C-084). */
  #ellipse([[xx, xy, xt], [yx, yy, yt]]: GradientTransform, { width, height }: Box): string | null {
    if (Math.abs(xy) > GRADIENT_NUMBER.straight || Math.abs(yx) > GRADIENT_NUMBER.straight || xx === 0 || yy === 0) {
      return null;
    }

    return GRADIENT_TEXT.ellipse(
      [this.#lengths.px(width / (2 * Math.abs(xx))), this.#lengths.px(height / (2 * Math.abs(yy)))].join(
        GRADIENT_VALUE.space,
      ),
      this.#decimal(((GRADIENT_NUMBER.half - xt) / xx) * GRADIENT_NUMBER.percent),
      this.#decimal(((GRADIENT_NUMBER.half - yt) / yy) * GRADIENT_NUMBER.percent),
    );
  }

  /**
   * A conic gradient's start and centre (C-085): the centre is the unit square's middle taken back through the
   * transform, the start the px direction along which the second row stays constant, flipped with a mirrored transform.
   */
  #conic(
    transform: GradientTransform,
    { width, height }: Box,
    stops: string,
  ): string | null {
    const back = this.#geometry.inverse(transform);

    if (back === null) {
      return null;
    }

    const [[xx, xy], [yx, yy]] = transform;
    const [across, down] = this.#geometry.through(back, [GRADIENT_NUMBER.half, GRADIENT_NUMBER.half]);
    const flip = (xx / width) * (yy / height) + (xy / height) * (-yx / width) < 0 ? -1 : 1;
    const angle = this.#decimal(this.#geometry.angle((flip * yy) / height, (-flip * yx) / width));
    const centre = [
      this.#decimal(across * GRADIENT_NUMBER.percent),
      this.#decimal(down * GRADIENT_NUMBER.percent),
    ] as const;

    return GRADIENT_TEXT.conic(angle, centre, stops);
  }

  /** A stop's colour, the paint's opacity folded in: a bound stop's token keeps its variable's alpha (FX-047). */
  #color(
    stop: Stop,
    paint: Paint,
    model: ReadModel,
  ): string {
    // Figma's ColorStop carries its bound variables as a loose field.
    const { boundVariables } = stop;

    return this.#solid.color(stop.color, boundVariables, paint.opacity ?? 1, model);
  }

  /** Figma's transform when the paint has a 2 x 3 one. */
  #transform(value: Paint["gradientTransform"]): GradientTransform | null {
    const [first, second] = value ?? [];

    return value?.length === 2 && first?.length === 3 && second?.length === 3
      ? [
        [first[0] ?? 0, first[1] ?? 0, first[2] ?? 0],
        [second[0] ?? 0, second[1] ?? 0, second[2] ?? 0],
      ]
      : null;
  }

  #decimal(value: number): number {
    return this.#format.round(value, PRECISION.decimal);
  }
}

export const GRADIENT_CSS = new InjectionToken<GradientCss>("GradientCss");
