import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EDGE, EDGE_AXIS, LUMINANCE } from "@/core/images/images.constants.ts";
import type { EdgeAxis, EdgeLines } from "@/core/images/images.types.ts";
import { RGBA } from "@/core/images/rgba.ts";
import type { RgbaImage } from "@/core/ports/pixel-diff.port.ts";

/** Each pixel's luminance step from the one before it across the lines (rows or columns): 1 lighter, -1 darker, 0. */
interface Steps {
  readonly lines: number;
  readonly span: number;
  readonly signs: Int8Array;
}

/** A stepping pixel: its line, its place along the line, and its step's direction. */
interface StepAt {
  readonly line: number;
  readonly along: number;
  readonly sign: number;
}

/**
 * How a reference's horizontal edges (rows, by y) and vertical ones (columns, by x) pair with a render's (S-094). An
 * edge pairs by the pixels on it, not by position alone (B-007): an edge of one image is where the other has the same
 * step (same pixels, same direction) within EDGE.maxShift lines, so a curve antialiased another way, whose edge rows
 * come and go, never borrows an unrelated edge and reads as a shift.
 */
@injectable()
export class EdgeDiff {
  readonly #rgba;

  constructor(rgba = inject(RGBA)) {
    this.#rgba = rgba;
  }

  of(reference: RgbaImage, node: RgbaImage): { rows: EdgeLines; columns: EdgeLines } {
    const theirs = this.#luminance(reference);
    const ours = this.#luminance(node);

    return {
      rows: this.#diff(this.#steps(reference, theirs, EDGE_AXIS.rows), this.#steps(node, ours, EDGE_AXIS.rows)),
      columns: this.#diff(
        this.#steps(reference, theirs, EDGE_AXIS.columns),
        this.#steps(node, ours, EDGE_AXIS.columns),
      ),
    };
  }

  /** Each of the reference's edges matched, shifted or missing in the render; the render's own edges extra. */
  #diff(reference: Steps, node: Steps): EdgeLines {
    const shifted: EdgeLines["shifted"] = [];
    const missing: number[] = [];
    let matched = 0;

    for (const edge of this.#edges(reference)) {
      const by = this.#offset(edge, reference, node);

      if (by === null) {
        missing.push(edge);
      } else if (by === 0) {
        matched += 1;
      } else {
        shifted.push({ reference: edge, node: edge + by, by });
      }
    }

    return {
      matched,
      shifted: shifted.slice(0, EDGE.listMax),
      missing: missing.slice(0, EDGE.listMax),
      extra: this.#edges(node)
        .filter((edge) => this.#offset(edge, node, reference) === null)
        .slice(0, EDGE.listMax),
    };
  }

  /**
   * Where the lines of an edge run: a line counts when enough of it steps from the line before; neighbouring lines of
   * one soft edge count once, at the strongest (a hairline gives its top and its bottom).
   */
  #edges({ lines, span, signs }: Steps): number[] {
    const shares = Array.from({ length: lines }, (_empty, line) => {
      let stepping = 0;

      for (let along = 0; along < span; along++) {
        stepping += Number((signs[line * span + along] ?? 0) !== 0);
      }

      return stepping / span;
    });

    return this.#peaks(shares);
  }

  /**
   * How many lines further on `to` has the edge at `line` of `from`: the commonest offset of its pixels' nearest like
   * steps (the smaller on a tie), or null when under half of its pixels have one within EDGE.maxShift.
   */
  #offset(
    line: number,
    from: Steps,
    to: Steps,
  ): number | null {
    const counts = new Map<number, number>();
    let pixels = 0;

    for (let along = 0; along < from.span; along++) {
      const sign = from.signs[line * from.span + along] ?? 0;
      const offset = sign === 0 ? null : this.#nearest(to, { line, along, sign });

      pixels += Number(sign !== 0);

      if (offset !== null) {
        counts.set(offset, (counts.get(offset) ?? 0) + 1);
      }
    }

    const found = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const best = this.#commonest(counts);

    return best === null || found * 2 < pixels ? null : best;
  }

  /** The offset most pixels found, the smaller on a tie. */
  #commonest(counts: ReadonlyMap<number, number>): number | null {
    let best: number | null = null;
    let most = 0;

    for (const [offset, count] of counts) {
      if (count > most || (count === most && best !== null && Math.abs(offset) < Math.abs(best))) {
        best = offset;
        most = count;
      }
    }

    return best;
  }

  /** The offset of the nearest line where `steps` has a step of `sign` at `along`, from `line` out to EDGE.maxShift. */
  #nearest(steps: Steps, { line, along, sign }: StepAt): number | null {
    if (along >= steps.span) {
      return null;
    }

    for (let distance = 0; distance <= EDGE.maxShift; distance++) {
      for (const offset of distance === 0 ? [0] : [distance, -distance]) {
        const at = line + offset;

        if (at >= 1 && at < steps.lines && steps.signs[at * steps.span + along] === sign) {
          return offset;
        }
      }
    }

    return null;
  }

  /** The steps across rows (each pixel against the one above) or across columns (against the one on its left). */
  #steps(
    { width, height }: RgbaImage,
    light: Float32Array,
    axis: EdgeAxis,
  ): Steps {
    const rows = axis === EDGE_AXIS.rows;
    const lines = rows ? height : width;
    const span = rows ? width : height;
    const at = (line: number, along: number) => light[rows ? line * width + along : along * width + line] ?? 0;
    const signs = new Int8Array(lines * span);

    for (let line = 1; line < lines; line++) {
      for (let along = 0; along < span; along++) {
        const step = at(line, along) - at(line - 1, along);

        signs[line * span + along] = Math.abs(step) > EDGE.step ? Math.sign(step) : 0;
      }
    }

    return { lines, span, signs };
  }

  /** Luminance 0-255 per pixel, over white where the image is transparent. */
  #luminance(image: RgbaImage): Float32Array {
    const light = new Float32Array(image.width * image.height);

    for (let pixel = 0; pixel < light.length; pixel++) {
      light[pixel] = LUMINANCE.reduce(
        (sum, weight, channel) => sum + weight * this.#rgba.overWhite(image, pixel, channel),
        0,
      );
    }

    return light;
  }

  /** The positions whose share passes EDGE.minShare, each run of neighbours kept once, at its strongest. */
  #peaks(shares: readonly number[]): number[] {
    const found: number[] = [];
    let best = -1;
    let last = -2;

    for (const [index, share] of shares.entries()) {
      if (share < EDGE.minShare) {
        continue;
      }

      if (index !== last + 1) {
        found.push(...(best >= 0 ? [best] : []));
        best = index;
      } else if (share > (shares[best] ?? 0)) {
        best = index;
      }

      last = index;
    }

    return best >= 0 ? [...found, best] : found;
  }
}

export const EDGE_DIFF = new InjectionToken<EdgeDiff>("EdgeDiff");
