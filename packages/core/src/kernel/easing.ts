import { roundTo } from "./numbers.ts";
import { type PhysicalSpring, SpringMotion } from "./spring.ts";

/**
 * A Figma easing in any of its forms: a prototype transition's (a cubic bezier or a physical spring), a Motion
 * keyframe's (a bezier as numbers, or a normalized spring's bounce), an EASING variable's.
 */
export interface FigmaEasing {
  readonly type: string;
  readonly easingFunctionCubicBezier?:
    | { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
    | undefined;
  readonly easingFunctionSpring?: PhysicalSpring | undefined;
  readonly bezier?: readonly number[] | undefined;
  readonly bounce?: number | undefined;
}

/** Figma's named curves as cubic Béziers. */
const NAMED_CURVES: Readonly<Record<string, readonly number[]>> = {
  LINEAR: [0, 0, 1, 1],
  EASE_IN: [0.42, 0, 1, 1],
  EASE_OUT: [0, 0, 0.58, 1],
  EASE_IN_AND_OUT: [0.42, 0, 0.58, 1],
  EASE_IN_BACK: [0.36, 0, 0.66, -0.56],
  EASE_OUT_BACK: [0.34, 1.56, 0.64, 1],
  EASE_IN_AND_OUT_BACK: [0.68, -0.6, 0.32, 1.6],
};

/** The cubic Béziers CSS has a keyword for, by their numbers. */
const CSS_KEYWORDS: Readonly<Record<string, string>> = {
  "0, 0, 1, 1": "linear",
  "0.42, 0, 1, 1": "ease-in",
  "0, 0, 0.58, 1": "ease-out",
  "0.42, 0, 0.58, 1": "ease-in-out",
  "0.25, 0.1, 0.25, 1": "ease",
};

/**
 * Figma's spring presets as physical springs. Figma does not publish their numbers; these are the ones its interaction
 * panel is reported to show for each preset (mass, stiffness, damping).
 */
const SPRING_PRESETS: Readonly<Record<string, PhysicalSpring>> = {
  GENTLE: {
    mass: 1,
    stiffness: 100,
    damping: 15,
  },
  QUICK: {
    mass: 1,
    stiffness: 300,
    damping: 20,
  },
  BOUNCY: {
    mass: 1,
    stiffness: 600,
    damping: 15,
  },
  SLOW: {
    mass: 1,
    stiffness: 80,
    damping: 20,
  },
};

/** How far a linear() easing may stray from the spring it draws, in progress. */
const SPRING_TOLERANCE = 0.002;

/** How finely a spring is sampled before its linear() is simplified. */
const SPRING_SAMPLES = 240;

/**
 * An easing as valid CSS: a keyword where CSS has one, else cubic-bezier() with Figma's numbers; a hold as step-end;
 * a spring as linear() drawn from the spring itself. Null for a type Figma does not have.
 */
export function easingCss(easing: FigmaEasing): string | null {
  if (easing.type === "HOLD") {
    return "step-end";
  }

  const curve = curveOf(easing);

  if (curve !== null) {
    const numbers = curve.map((point) => String(roundTo(point, 3))).join(", ");

    return CSS_KEYWORDS[numbers] ?? `cubic-bezier(${numbers})`;
  }

  const spring = springOf(easing);

  return spring === null ? null : springCss(spring.motion, spring.span);
}

/** The easing's cubic Bézier: its own numbers, else its named curve's. */
function curveOf(easing: FigmaEasing): readonly number[] | null {
  const custom = easing.easingFunctionCubicBezier;

  if (custom !== undefined) {
    return [custom.x1, custom.y1, custom.x2, custom.y2];
  }

  return easing.bezier?.length === 4 ? easing.bezier : (NAMED_CURVES[easing.type] ?? null);
}

/** The easing's spring and the time it is drawn over: a physical one until it settles, a normalized one over 1. */
function springOf(easing: FigmaEasing): { motion: SpringMotion; span: number } | null {
  const physical = easing.easingFunctionSpring ?? SPRING_PRESETS[easing.type];

  if (physical !== undefined) {
    const motion = SpringMotion.physical(physical);

    return {
      motion,
      span: motion.settleTime(),
    };
  }

  return easing.bounce === undefined
    ? null
    : {
        motion: SpringMotion.normalized(easing.bounce),
        span: 1,
      };
}

/** A spring as linear(): its progress sampled over the span, kept to the stops that matter, ending at 1. */
function springCss(motion: SpringMotion, span: number): string {
  const points = Array.from({ length: SPRING_SAMPLES + 1 }, (_, index) => {
    const at = index / SPRING_SAMPLES;

    return [at, index === SPRING_SAMPLES ? 1 : 1 - motion.displacement(at * span)] as const;
  });
  const kept = simplified(points, SPRING_TOLERANCE);
  const stops = kept.map(([at, progress], index) =>
    index === 0 || index === kept.length - 1
      ? String(roundTo(progress, 3))
      : `${roundTo(progress, 3)} ${roundTo(at * 100, 2)}%`,
  );

  return `linear(${stops.join(", ")})`;
}

/**
 * The points a polyline needs to stay within `tolerance` of all of them (Ramer–Douglas–Peucker): the ends, and each
 * point farthest from the line between the points kept around it, while it is farther than the tolerance.
 */
function simplified(points: readonly (readonly [number, number])[], tolerance: number): (readonly [number, number])[] {
  const keep = new Set([0, points.length - 1]);
  const spans: [number, number][] = [[0, points.length - 1]];

  for (let span = spans.pop(); span !== undefined; span = spans.pop()) {
    const [first, last] = span;
    const farthest = farthestFrom(points, first, last);

    if (farthest !== null && farthest.distance > tolerance) {
      keep.add(farthest.index);
      spans.push([first, farthest.index], [farthest.index, last]);
    }
  }

  return [...keep].sort((a, b) => a - b).map((index) => points[index] as readonly [number, number]);
}

/** The point between `first` and `last` farthest (in progress) from the straight line joining them. */
function farthestFrom(
  points: readonly (readonly [number, number])[],
  first: number,
  last: number,
): { index: number; distance: number } | null {
  const [x1, y1] = points[first] as readonly [number, number];
  const [x2, y2] = points[last] as readonly [number, number];
  let farthest: { index: number; distance: number } | null = null;

  for (let index = first + 1; index < last; index++) {
    const [x, y] = points[index] as readonly [number, number];
    const distance = Math.abs(y - (y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)));

    if (farthest === null || distance > farthest.distance) {
      farthest = {
        index,
        distance,
      };
    }
  }

  return farthest;
}
