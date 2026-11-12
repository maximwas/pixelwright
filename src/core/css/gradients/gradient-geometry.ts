import { InjectionToken, injectable } from "@needle-di/core";
import { GRADIENT_KIND, GRADIENT_NUMBER, GRADIENT_UNIT } from "@/core/css/gradients/gradients.constants.ts";
import type { Box, GradientLength, GradientSpec, GradientTransform } from "@/core/css/gradients/gradients.types.ts";

type Radial = Extract<GradientSpec, { type: typeof GRADIENT_KIND.radial }>;

/**
 * Figma's gradient transform and CSS's gradient line (C-083..C-086): both are measured in px of the box, so a
 * non-square box keeps its angle (getCSSAsync forgets the aspect and reads CSS 30deg on 200 x 100 as 49deg, FX-020).
 */
@injectable()
export class GradientGeometry {
  /** An angle in degrees from 0 to 360. */
  turn(degrees: number): number {
    return ((degrees % GRADIENT_NUMBER.fullTurn) + GRADIENT_NUMBER.fullTurn) % GRADIENT_NUMBER.fullTurn;
  }

  /** The CSS angle of a direction in px (0deg up, clockwise). */
  angle(x: number, y: number): number {
    return this.turn(Math.atan2(x, -y) * GRADIENT_NUMBER.degreesPerRadian);
  }

  /** The CSS gradient line's length for an angle: what 0% to 100% spans across the box. */
  lineLength(angle: number, { width, height }: Box): number {
    const radians = angle / GRADIENT_NUMBER.degreesPerRadian;

    return Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  }

  /** The inverse of a transform; null when it is flat. */
  inverse([[xx, xy, xt], [yx, yy, yt]]: GradientTransform): GradientTransform | null {
    const determinant = xx * yy - xy * yx;

    if (Math.abs(determinant) < GRADIENT_NUMBER.flat) {
      return null;
    }

    return [
      [yy / determinant, -xy / determinant, (xy * yt - xt * yy) / determinant],
      [-yx / determinant, xx / determinant, (xt * yx - xx * yt) / determinant],
    ];
  }

  /** A point through a transform. */
  through([[xx, xy, xt], [yx, yy, yt]]: GradientTransform, [x, y]: readonly [number, number]): [number, number] {
    return [xx * x + xy * y + xt, yx * x + yy * y + yt];
  }

  /**
   * Figma's transform for a CSS gradient on a box: a linear one runs along CSS's gradient line, so its stops keep their
   * places; a radial one's ellipse is CSS's; a conic one starts at CSS's angle round its centre.
   */
  transform(spec: GradientSpec, box: Box): GradientTransform {
    if (spec.type === GRADIENT_KIND.linear) {
      return this.#linear(spec.angle, box);
    }

    const centre: [number, number] = [this.#pixels(spec.center.x, box.width), this.#pixels(spec.center.y, box.height)];

    return spec.type === GRADIENT_KIND.radial
      ? this.#radial(spec, centre, box)
      : this.#angular(spec.angle, centre, box);
  }

  #linear(angle: number, box: Box): GradientTransform {
    const { width, height } = box;
    const radians = angle / GRADIENT_NUMBER.degreesPerRadian;
    const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
    const length = this.lineLength(angle, box) || 1;

    return [
      [(width * sin) / length, (-height * cos) / length, 0.5 - (width * sin - height * cos) / (2 * length)],
      [(width * cos) / length, (height * sin) / length, 0.5 - (width * cos + height * sin) / (2 * length)],
    ];
  }

  #radial(
    spec: Radial,
    [cx, cy]: [number, number],
    { width, height }: Box,
  ): GradientTransform {
    // Without a size CSS reaches the farthest corner.
    const rx = (spec.radii === null ? Math.max(cx, width - cx) * Math.SQRT2 : this.#pixels(spec.radii.x, width)) || 1;
    const ry = (spec.radii === null ? Math.max(cy, height - cy) * Math.SQRT2 : this.#pixels(spec.radii.y, height)) || 1;

    return [
      [width / (2 * rx), 0, 0.5 - cx / (2 * rx)],
      [0, height / (2 * ry), 0.5 - cy / (2 * ry)],
    ];
  }

  #angular(
    angle: number,
    [cx, cy]: [number, number],
    { width, height }: Box,
  ): GradientTransform {
    const radians = angle / GRADIENT_NUMBER.degreesPerRadian;
    const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
    const scale = Math.max(width, height) || 1;

    return [
      [(width * sin) / scale, (-height * cos) / scale, 0.5 - (cx * sin - cy * cos) / scale],
      [(width * cos) / scale, (height * sin) / scale, 0.5 - (cx * cos + cy * sin) / scale],
    ];
  }

  /** A length in px on an axis of the box. */
  #pixels(length: GradientLength, size: number): number {
    return length.unit === GRADIENT_UNIT.percent ? (length.value / GRADIENT_NUMBER.percent) * size : length.value;
  }
}

export const GRADIENT_GEOMETRY = new InjectionToken<GradientGeometry>("GradientGeometry");
