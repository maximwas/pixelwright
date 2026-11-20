import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { PathArray } from "svg-path-commander";
import {
  cubicTools,
  getPathBBox,
  normalizePath,
  pathToCurve,
  roundPath,
  splitCubicSegment,
  transformPath,
} from "svg-path-commander/util";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { WriteInput } from "@/core/css/css.types.ts";
import { PATH_NUMBER, PATH_PATTERN, TEXT_VALUE } from "@/core/css/groups/text/text.constants.ts";
import { CSS_ANGLE } from "@/core/css/values/css-angle.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** An arc's path in its own box, and where that box's corner sits in the parent. */
export interface ArcPath {
  readonly path: string;
  readonly x: number;
  readonly y: number;
}

export type PathStart = NonNullable<FigmaProps["pathStart"]>;

/** A cubic curve as its start, its two control points and its end. */
type Cubic = [number, number, number, number, number, number, number, number];

/**
 * A text on a path's geometry written back (T-140): any SVG path as Figma's vector data, an arc of a circle as one, and
 * where along a path a share of its length falls, as Figma's start takes it (B-032).
 */
@injectable()
export class PathGeometry {
  readonly #angle;

  constructor(angle = inject(CSS_ANGLE)) {
    this.#angle = angle;
  }

  /** Absolute M, L, Q, C and Z, an arc as curves, three decimals; null when it is no path or draws nothing. */
  figmaPath(path: string): string | null {
    try {
      const normal = normalizePath(path);

      if (normal.length < PATH_NUMBER.fewestCommands) {
        return null;
      }

      const curved = normal.some(([command]) => command === PATH_PATTERN.arcCommand) ? pathToCurve(normal) : normal;

      return this.#written(roundPath(curved, PATH_NUMBER.writtenPlaces));
    } catch {
      return null;
    }
  }

  /**
   * `cx cy r from to`: centre and radius in px, from and to in degrees as CSS turns (0 at the top, clockwise; a smaller
   * `to` runs back), as Figma's path in its own box. Null when it is no arc: no radius, no turn, or more than a circle.
   */
  arc(value: string): ArcPath | null {
    const parts = value.trim().split(PATH_PATTERN.spaces);
    const [cx, cy, radius] = parts
      .slice(0, PATH_NUMBER.arcLengths)
      .map((part) => this.#number(part.replace(PATH_PATTERN.px, "")));
    const [from, to] = parts
      .slice(PATH_NUMBER.arcLengths)
      .map((part) => this.#number(part) ?? this.#angle.degrees(part));

    if (parts.length !== PATH_NUMBER.arcParts || [cx, cy, radius, from, to].some((part) => typeof part !== "number")) {
      return null;
    }

    return this.#arcPath([cx ?? 0, cy ?? 0, radius ?? 0], from ?? 0, to ?? 0);
  }

  /** The path a new TextPath is made along (its arc, else its d), or the one a TextPath there has. */
  pathOf({ own, merged, existing }: WriteInput): string | null {
    const arc = own(ATTRIBUTE.arc);
    const given = existing ? merged(ATTRIBUTE.d) : own(ATTRIBUTE.d);

    if (!existing && arc !== undefined) {
      return this.arc(arc)?.path ?? null;
    }

    return given === undefined ? null : this.figmaPath(given);
  }

  /**
   * Where a share of the path's length falls (0 its beginning, 1 its end): the segment, moves not counted, and the
   * place on it as Figma takes it, the curve's own parameter (live: not a share of the segment's length). Where two
   * segments meet it is the next one's beginning. Null for a path of no length.
   */
  startAlong(path: string, share: number): PathStart | null {
    const pieces = this.#cubics(path).map((cubic) => ({ cubic, length: cubicTools.getCubicLength(...cubic) }));
    const target = share * pieces.reduce((sum, { length }) => sum + length, 0);
    let before = 0;

    for (const [segment, { cubic, length }] of pieces.entries()) {
      // Past a joint by more than float noise: the middle of two equal pieces is the second one's beginning.
      if (length > 0 && before + length > target + PATH_NUMBER.noise) {
        return { segment, position: this.#rounded(this.#parameterAt(cubic, target - before)) };
      }

      before += length;
    }

    const last = pieces.map(({ length }) => length > 0).lastIndexOf(true);

    return last === -1 ? null : { segment: last, position: 1 };
  }

  #arcPath(
    [cx, cy, radius]: readonly [number, number, number],
    from: number,
    to: number,
  ): ArcPath | null {
    const turn = to - from;

    if (radius <= 0 || turn === 0 || Math.abs(turn) > PATH_NUMBER.circle) {
      return null;
    }

    const point = (degrees: number) => {
      const radians = (degrees * Math.PI) / PATH_NUMBER.halfCircle;
      // Rounded past float noise: sin(180°) is 1.2e-16, which a path reads as an exponent.
      const round = (value: number) => Math.round(value * PATH_NUMBER.pointScale) / PATH_NUMBER.pointScale;

      return [round(cx + radius * Math.sin(radians)), round(cy - radius * Math.cos(radians))].join(TEXT_VALUE.space);
    };
    // Pieces of a quarter at most: each is one cubic curve close to the circle, and a whole circle can end where it starts.
    const pieces = Math.ceil(Math.abs(turn) / PATH_NUMBER.quarter);
    const sweep = turn > 0 ? 1 : 0;
    const arcs = Array.from({ length: pieces }, (_piece, index) =>
      [PATH_PATTERN.arcCommand, radius, radius, 0, 0, sweep, point(from + (turn * (index + 1)) / pieces)].join(
        TEXT_VALUE.space,
      ),
    );
    const curve = pathToCurve([PATH_PATTERN.moveCommand, point(from), ...arcs].join(TEXT_VALUE.space));
    const box = getPathBBox(curve);

    return {
      path: this.#written(roundPath(transformPath(curve, { translate: [-box.x, -box.y] }), PATH_NUMBER.writtenPlaces)),
      x: box.x,
      y: box.y,
    };
  }

  /** The path's segments as cubic curves, in order, each from where the one before ends (lines and Z as straight ones). */
  #cubics(path: string): Cubic[] {
    const cubics: Cubic[] = [];
    let at: [number, number] = [0, 0];

    // pathToCurve keeps a later move as M, though its type says only the first.
    for (const [command, ...numbers] of pathToCurve(path) as readonly (readonly [string, ...number[]])[]) {
      if (command !== PATH_PATTERN.moveCommand) {
        cubics.push([...at, ...numbers] as Cubic);
      }

      at = [numbers.at(-2) ?? 0, numbers.at(-1) ?? 0];
    }

    return cubics;
  }

  /** The curve's parameter at a distance along it from its start, by halving. */
  #parameterAt(cubic: Cubic, distance: number): number {
    let low = 0;
    let high = 1;

    for (let step = 0; step < PATH_NUMBER.bisections; step += 1) {
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

  #number(part: string): number | null {
    return PATH_PATTERN.number.test(part) ? Number(part) : null;
  }

  #rounded(position: number): number {
    return Math.round(position * PATH_NUMBER.startScale) / PATH_NUMBER.startScale;
  }

  /** A path as Figma writes its data: each command and its numbers apart by spaces. */
  #written(path: PathArray): string {
    return path.map((segment) => segment.join(TEXT_VALUE.space)).join(TEXT_VALUE.space);
  }
}

export const PATH_GEOMETRY = new InjectionToken<PathGeometry>("PathGeometry");
