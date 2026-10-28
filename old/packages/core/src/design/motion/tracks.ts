import { easingCss } from "../../kernel/easing.ts";
import type { MotionEasing, MotionTrack, SnapshotMotion } from "./types.ts";
import { MOTION_AXES } from "./vocabulary.ts";

/** A keyframe with its value made absolute from the track's base. */
export interface Point {
  readonly t: number;
  readonly value: unknown;
  readonly easing: MotionEasing;
}

/** A point on a plane: a position or a scale on both axes. */
type Vector = { x: number; y: number };

/**
 * The values CSS animates: for translate and rotate the change from the layer's own place and angle (Figma's base is
 * the layer's x, y and rotation, which its layout and transform already give); else the value itself.
 */
export function cssPoints(track: MotionTrack): Point[] {
  const points = pointsOf(track);

  if (track.field !== "ROTATION" && MOTION_AXES[track.field]?.property !== "translate") {
    return points;
  }

  return points.map((point) => ({
    ...point,
    value: combine(point.value, track.base.value, (value, base) => value - base),
  }));
}

/** The timeline's length; without one (or a zero one), the latest keyframe's time. */
export function durationOf(motion: SnapshotMotion): number {
  if (motion.timeline !== undefined && motion.timeline > 0) {
    return motion.timeline;
  }

  return Math.max(0, ...motion.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.t)));
}

/** A value between two keyframes, taken linearly; held before the first and after the last. */
export function sample(points: readonly { t: number; value: number }[], t: number): number {
  const after = points.findIndex((point) => point.t >= t);
  const next = points[after];
  const previous = points[after - 1];

  if (next === undefined) {
    return points.at(-1)?.value ?? 0;
  }

  if (previous === undefined || next.t === t) {
    return next.value;
  }

  return previous.value + ((next.value - previous.value) * (t - previous.t)) / (next.t - previous.t);
}

/** One axis of a value: a number is the same on both. */
export function componentOf(value: unknown, axis: "x" | "y"): number | null {
  if (typeof value === "number") {
    return value;
  }

  return isVector(value) ? value[axis] : null;
}

export function isVector(value: unknown): value is Vector {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

/** A keyframe's easing as valid CSS (a spring as linear() over the keyframe's own time); linear when unknown. */
export function keyframeEasing(easing: MotionEasing): string {
  return easingCss(easing) ?? "linear";
}

/** A track's keyframes in time order, each value made absolute: OFFSET adds it to the base, SCALE multiplies it. */
function pointsOf(track: MotionTrack): Point[] {
  const base = track.base.value;

  return [...track.keyframes]
    .sort((a, b) => a.t - b.t)
    .map(({ t, value, easing }) => ({
      t,
      value:
        track.operation === "OFFSET"
          ? combine(base, value.value, (a, b) => a + b)
          : track.operation === "SCALE"
            ? combine(base, value.value, (a, b) => a * b)
            : value.value,
      easing,
    }));
}

function combine(base: unknown, value: unknown, operation: (a: number, b: number) => number): unknown {
  if (typeof base === "number" && typeof value === "number") {
    return operation(base, value);
  }

  if (isVector(base) && isVector(value)) {
    return {
      x: operation(base.x, value.x),
      y: operation(base.y, value.y),
    };
  }

  return value;
}
