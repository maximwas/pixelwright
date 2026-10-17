import { Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { variableTokenName } from "../../kernel/names.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotPaint } from "../../types/snapshot.ts";
import { px } from "./format.ts";
import { angleOf, type Box, type GradientTransform, inverse, lineLength, through } from "./gradient-geometry.ts";

/** What a gradient's stops are written with: the file's colour space, and its variables for a bound stop. */
type StopContext = Partial<Pick<CssContext, "colorSpace" | "variables" | "tokens">>;

type Stop = NonNullable<SnapshotPaint["gradientStops"]>[number];

/** Whether a value is Figma's 2×3 transform. */
function isTransform(value: unknown): value is GradientTransform {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((row) => Array.isArray(row) && row.length === 3 && row.every((cell) => typeof cell === "number"))
  );
}

/**
 * A gradient paint as CSS on the box it fills: linear-gradient (the angle and stops along CSS's gradient line),
 * radial-gradient (an ellipse's radii and centre), conic-gradient (its start and centre). A paint's opacity goes into
 * its stops. Null for what CSS cannot draw: a diamond, a turned ellipse, a flat transform.
 */
export function gradientCss(paint: SnapshotPaint, box: Box, context: StopContext = {}): string | null {
  const transform = paint.gradientTransform;
  const stops = paint.gradientStops ?? [];

  if (!isTransform(transform) || stops.length === 0) {
    return null;
  }

  const stop = (each: Stop, place: number) =>
    `${stopColor(each, paint.opacity ?? 1, context)} ${decimal(place * 100)}%`;

  if (paint.type === "GRADIENT_LINEAR") {
    return linearCss(transform, box, (place) => stops.map((each) => stop(each, place(each.position))));
  }

  const list = stops.map((each) => stop(each, each.position)).join(", ");

  if (paint.type === "GRADIENT_RADIAL") {
    const shape = radialShape(transform, box);

    return shape === null ? null : `radial-gradient(${shape}, ${list})`;
  }

  const start = paint.type === "GRADIENT_ANGULAR" ? conicStart(transform, box) : null;

  return start === null ? null : `conic-gradient(${start}, ${list})`;
}

/**
 * A linear gradient's angle and its stops: a Figma stop's place along the gradient becomes its place along CSS's
 * gradient line, which runs through the box's centre and reaches its far corners.
 */
function linearCss(
  [[a, b, c]]: GradientTransform,
  box: Box,
  stops: (place: (position: number) => number) => string[],
): string | null {
  const [gx, gy] = [a / box.width, b / box.height];

  if (!Number.isFinite(gx) || !Number.isFinite(gy) || (gx === 0 && gy === 0)) {
    return null;
  }

  const angle = angleOf(gx, gy);
  const span = Math.hypot(gx, gy) * lineLength(angle, box);
  const middle = (a + b) / 2 + c;

  return `linear-gradient(${decimal(angle)}deg, ${stops((position) => (position - middle) / span + 0.5).join(", ")})`;
}

/** An ellipse's radii and centre, `120px 40px at 30% 60%`; null for a turned or skewed one. */
function radialShape([[a, b, c], [d, e, f]]: GradientTransform, { width, height }: Box): string | null {
  if (Math.abs(b) > 1e-6 || Math.abs(d) > 1e-6 || a === 0 || e === 0) {
    return null;
  }

  return `${px(width / (2 * Math.abs(a)))} ${px(height / (2 * Math.abs(e)))} at ${decimal(((0.5 - c) / a) * 100)}% ${decimal(((0.5 - f) / e) * 100)}%`;
}

/** A conic gradient's start angle and centre, `from 90deg at 50% 50%`. */
function conicStart(transform: GradientTransform, { width, height }: Box): string | null {
  const back = inverse(transform);

  if (back === null) {
    return null;
  }

  const [[a, b], [d, e]] = transform;
  const [u, v] = through(back, 0.5, 0.5);
  const flip = (a / width) * (e / height) + (b / height) * (-d / width) < 0 ? -1 : 1;

  return `from ${decimal(angleOf((flip * e) / height, (-flip * d) / width))}deg at ${decimal(u * 100)}% ${decimal(v * 100)}%`;
}

/** A stop's colour: its variable's token (mixed with transparent under an opacity), else its colour faded by it. */
function stopColor(stop: Stop, opacity: number, { colorSpace, variables, tokens }: StopContext): string {
  const alias = (stop as { boundVariables?: { color?: { id?: unknown } } }).boundVariables?.color?.id;
  const variable = typeof alias === "string" ? variables?.[alias] : undefined;
  const space: ColorSpace = colorSpace ?? "srgb";

  if (variable === undefined) {
    return Color.of(stop.color, space).faded(opacity).css();
  }

  const name = variableTokenName(variable);

  tokens?.set(name, Color.of(stop.color, space).css());

  return opacity < 1
    ? `color-mix(in ${space}, var(${name}) ${Math.round(opacity * 100)}%, transparent)`
    : `var(${name})`;
}
