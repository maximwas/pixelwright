import type { PathArray } from "svg-path-commander";
import {
  cubicTools,
  getPathBBox,
  normalizePath,
  parsePathString,
  pathToCurve,
  roundPath,
  splitCubicSegment,
  transformPath,
} from "svg-path-commander/util";
import { roundTo } from "../../kernel/numbers.ts";

/** An arc's path in its own box, and where that box's corner sits in the parent. */
export interface ArcPath {
  readonly d: string;
  readonly x: number;
  readonly y: number;
}

/** Where a text on a path starts: a segment of the path, counted from 0, and Figma's place along it from 0 to 1. */
export interface PathStart {
  readonly segment: number;
  readonly position: number;
}

/** A cubic curve as its start, its two control points and its end. */
type Cubic = [number, number, number, number, number, number, number, number];

/** Steps of halving that find a place on a curve well past the 4 decimals a start keeps. */
const BISECTIONS = 30;

/** Figma's vector paths as one SVG path, its numbers to two decimals: a text on a path's d, as design_read writes it. */
export function pathData(paths: readonly { readonly data: string }[]): string {
  return written(roundPath(parsePathString(paths.map(({ data }) => data).join(" ")), 2));
}

/**
 * An SVG path as Figma's vector paths take one: absolute M, L, Q, C and Z, an arc as curves; null when it is no path
 * or draws nothing.
 */
export function figmaPath(d: string): string | null {
  try {
    const normal = normalizePath(d);

    if (normal.length < 2) {
      return null;
    }

    return written(roundPath(normal.some(([command]) => command === "A") ? pathToCurve(normal) : normal, 3));
  } catch {
    return null;
  }
}

/**
 * A circle's arc as Figma's path, in its own box: centre and radius in px, from and to in degrees as CSS turns (0 at
 * the top, clockwise; a smaller `to` runs back). Null when it is no arc: no radius, no turn, or more than a circle.
 */
export function arcPath(cx: number, cy: number, r: number, [from, to]: readonly [number, number]): ArcPath | null {
  const turn = to - from;

  if (r <= 0 || turn === 0 || Math.abs(turn) > 360) {
    return null;
  }

  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;

    // Rounded past float noise: sin(180°) is 1.2e-16, which a path reads as an exponent.
    return `${roundTo(cx + r * Math.sin(radians), 6)} ${roundTo(cy - r * Math.cos(radians), 6)}`;
  };
  // Pieces of a quarter at most: each is one cubic curve close to the circle, and a whole circle can end where it starts.
  const pieces = Math.ceil(Math.abs(turn) / 90);
  const arcs = Array.from(
    { length: pieces },
    (_, index) => `A ${r} ${r} 0 0 ${turn > 0 ? 1 : 0} ${point(from + (turn * (index + 1)) / pieces)}`,
  );
  const curve = pathToCurve(`M ${point(from)} ${arcs.join(" ")}`);
  const box = getPathBBox(curve);

  return {
    d: written(roundPath(transformPath(curve, { translate: [-box.x, -box.y] }), 3)),
    x: box.x,
    y: box.y,
  };
}

/**
 * Where a share of a path's length falls (0 its beginning, 1 its end), as a text on it starts there: the segment, the
 * moves not counted, and the place on that segment as Figma takes it, the curve's own parameter (live: not the share
 * of the segment's length). Where two segments meet it is the next one's beginning. Null for a path of no length.
 */
export function startAlong(d: string, share: number): PathStart | null {
  const pieces = cubicsOf(d).map((cubic) => ({
    cubic,
    length: cubicTools.getCubicLength(...cubic),
  }));
  const target = share * pieces.reduce((sum, { length }) => sum + length, 0);
  let before = 0;

  for (const [segment, { cubic, length }] of pieces.entries()) {
    // Past a joint by more than float noise: the middle of two equal pieces is the second one's beginning.
    if (length > 0 && before + length > target + 1e-9) {
      return {
        segment,
        position: roundTo(parameterAt(cubic, target - before), 4),
      };
    }

    before += length;
  }

  const last = pieces.findLastIndex(({ length }) => length > 0);

  return last === -1
    ? null
    : {
        segment: last,
        position: 1,
      };
}

/** A path's segments as cubic curves, in order, each from where the one before ends (lines and Z as straight ones). */
function cubicsOf(d: string): Cubic[] {
  const cubics: Cubic[] = [];
  let at: [number, number] = [0, 0];

  // pathToCurve keeps a later move as M, though its type says only the first.
  for (const [command, ...numbers] of pathToCurve(d) as readonly (readonly [string, ...number[]])[]) {
    if (command !== "M") {
      cubics.push([...at, ...numbers] as Cubic);
    }

    at = [numbers.at(-2) ?? 0, numbers.at(-1) ?? 0];
  }

  return cubics;
}

/** The curve's parameter at a distance along it from its start. */
function parameterAt(cubic: Cubic, distance: number): number {
  let low = 0;
  let high = 1;

  for (let step = 0; step < BISECTIONS; step += 1) {
    const middle = (low + high) / 2;
    const [head] = splitCubicSegment(...cubic, middle);

    if (cubicTools.getCubicLength(...head) < distance) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

/** A path as Figma writes its data: each command and its numbers apart by spaces. */
function written(path: PathArray): string {
  return path.map((segment) => segment.join(" ")).join(" ");
}
