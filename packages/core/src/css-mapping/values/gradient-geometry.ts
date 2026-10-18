import type { GradientLength, GradientSpec } from "../figma-props.ts";

/** Figma's gradientTransform: a 2×3 affine map from the layer's unit square to the gradient's space. */
export type GradientTransform = [[number, number, number], [number, number, number]];

/** A layer's size, which a gradient's CSS and Figma's transform are related through. */
export interface Box {
  readonly width: number;
  readonly height: number;
}

const DEGREES = 180 / Math.PI;

/** An angle in degrees from 0 to 360. */
export function turn(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** A length in px on an axis of the box. */
export function pixels(length: GradientLength, size: number): number {
  return length.unit === "%" ? (length.value / 100) * size : length.value;
}

/** The CSS gradient line's length for an angle: what 0% to 100% spans across the box. */
export function lineLength(angle: number, { width, height }: Box): number {
  const radians = angle / DEGREES;

  return Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
}

/** The inverse of a transform; null when it is flat. */
export function inverse([[a, b, c], [d, e, f]]: GradientTransform): GradientTransform | null {
  const determinant = a * e - b * d;

  if (Math.abs(determinant) < 1e-9) {
    return null;
  }

  return [
    [e / determinant, -b / determinant, (b * f - c * e) / determinant],
    [-d / determinant, a / determinant, (c * d - a * f) / determinant],
  ];
}

/** A point through a transform. */
export function through([[a, b, c], [d, e, f]]: GradientTransform, x: number, y: number): [number, number] {
  return [a * x + b * y + c, d * x + e * y + f];
}

/** The CSS angle of a direction in px (0deg up, clockwise). */
export function angleOf(x: number, y: number): number {
  return turn(Math.atan2(x, -y) * DEGREES);
}

/**
 * Figma's transform for a CSS gradient on a box: a linear gradient runs along CSS's gradient line, so its stops keep
 * their places; a radial one's ellipse is CSS's; a conic one starts at CSS's angle round its centre.
 */
export function gradientTransformOf(spec: GradientSpec, width: number, height: number): GradientTransform {
  const box = {
    width,
    height,
  };

  if (spec.type === "LINEAR") {
    return linearTransform(spec.angle, box);
  }

  const cx = pixels(spec.center.x, width);
  const cy = pixels(spec.center.y, height);

  return spec.type === "RADIAL" ? radialTransform(spec, [cx, cy], box) : angularTransform(spec.angle, [cx, cy], box);
}

function linearTransform(angle: number, box: Box): GradientTransform {
  const { width, height } = box;
  const radians = angle / DEGREES;
  const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
  const length = lineLength(angle, box) || 1;

  return [
    [(width * sin) / length, (-height * cos) / length, 0.5 - (width * sin - height * cos) / (2 * length)],
    [(width * cos) / length, (height * sin) / length, 0.5 - (width * cos + height * sin) / (2 * length)],
  ];
}

function radialTransform(
  spec: Extract<GradientSpec, { type: "RADIAL" }>,
  [cx, cy]: [number, number],
  { width, height }: Box,
): GradientTransform {
  // Without a size CSS reaches the farthest corner.
  const rx = spec.radii === null ? Math.max(cx, width - cx) * Math.SQRT2 : pixels(spec.radii.x, width);
  const ry = spec.radii === null ? Math.max(cy, height - cy) * Math.SQRT2 : pixels(spec.radii.y, height);

  return [
    [width / (2 * (rx || 1)), 0, 0.5 - cx / (2 * (rx || 1))],
    [0, height / (2 * (ry || 1)), 0.5 - cy / (2 * (ry || 1))],
  ];
}

function angularTransform(angle: number, [cx, cy]: [number, number], { width, height }: Box): GradientTransform {
  const radians = angle / DEGREES;
  const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
  const scale = Math.max(width, height) || 1;

  return [
    [(width * sin) / scale, (-height * cos) / scale, 0.5 - (cx * sin - cy * cos) / scale],
    [(width * cos) / scale, (height * sin) / scale, 0.5 - (cx * cos + cy * sin) / scale],
  ];
}
