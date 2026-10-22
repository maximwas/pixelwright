import type { PathArray } from "svg-path-commander";
import {
  getPathBBox,
  normalizePath,
  parsePathString,
  pathToCurve,
  roundPath,
  transformPath,
} from "svg-path-commander/util";
import { roundTo } from "../../kernel/numbers.ts";

/** An arc's path in its own box, and where that box's corner sits in the parent. */
export interface ArcPath {
  readonly d: string;
  readonly x: number;
  readonly y: number;
}

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

/** A path as Figma writes its data: each command and its numbers apart by spaces. */
function written(path: PathArray): string {
  return path.map((segment) => segment.join(" ")).join(" ");
}
