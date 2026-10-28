// Adapted from Sitewright, the same author's MIT project (its apps/server/src/images/edge-diff.ts).
import { EDGE_LIST_MAX, EDGE_MAX_SHIFT, EDGE_MIN_SHARE, EDGE_STEP } from "../constants/images.ts";
import type { EdgeDiff, RgbaImage } from "../types/images.ts";

/** Each pixel's luminance step from the one before it across the lines (rows or columns): 1 lighter, -1 darker, 0. */
interface Steps {
  readonly lines: number;
  readonly span: number;
  readonly signs: Int8Array;
}

/** How the reference's horizontal edges (rows, by y) and vertical ones (columns, by x) pair with the render's. */
export function edgeDiff(reference: RgbaImage, node: RgbaImage): { rows: EdgeDiff; columns: EdgeDiff } {
  const theirs = luminance(reference);
  const ours = luminance(node);

  return {
    rows: diffSteps(stepsOf(reference, theirs, "rows"), stepsOf(node, ours, "rows")),
    columns: diffSteps(stepsOf(reference, theirs, "columns"), stepsOf(node, ours, "columns")),
  };
}

/**
 * Edges pair by the pixels on them, not by position alone: an edge of one image is where the other has the same step
 * (same pixels, same direction) within EDGE_MAX_SHIFT lines, so a curve antialiased another way, whose edge rows come
 * and go, never borrows an unrelated edge and reads as a shift.
 */
function diffSteps(reference: Steps, node: Steps): EdgeDiff {
  const shifted: { reference: number; node: number; by: number }[] = [];
  const missing: number[] = [];
  let matched = 0;

  for (const edge of edgesOf(reference)) {
    const by = offsetOf(edge, reference, node);

    if (by === null) {
      missing.push(edge);
    } else if (by === 0) {
      matched += 1;
    } else {
      shifted.push({
        reference: edge,
        node: edge + by,
        by,
      });
    }
  }

  return {
    matched,
    shifted: shifted.slice(0, EDGE_LIST_MAX),
    missing: missing.slice(0, EDGE_LIST_MAX),
    extra: edgesOf(node)
      .filter((edge) => offsetOf(edge, node, reference) === null)
      .slice(0, EDGE_LIST_MAX),
  };
}

/**
 * Where the lines of an edge run: a line counts when enough of it steps from the line before; neighbouring lines of
 * one soft edge count once, at the strongest (a hairline gives its top and its bottom).
 */
function edgesOf({ lines, span, signs }: Steps): number[] {
  return peaks(
    Array.from({ length: lines }, (_, line) => countWhere(span, (along) => signs[line * span + along] !== 0) / span),
  );
}

/**
 * How many lines further on `to` has the edge at `line` of `from`: the commonest offset of its pixels' nearest like
 * steps (the smaller on a tie), or null when under half of its pixels have one within EDGE_MAX_SHIFT.
 */
function offsetOf(line: number, from: Steps, to: Steps): number | null {
  const counts = new Map<number, number>();
  let pixels = 0;

  for (let along = 0; along < from.span; along++) {
    const sign = from.signs[line * from.span + along] ?? 0;

    if (sign === 0) {
      continue;
    }

    pixels += 1;

    const offset = nearestStep(to, {
      line,
      along,
      sign,
    });

    if (offset !== null) {
      counts.set(offset, (counts.get(offset) ?? 0) + 1);
    }
  }

  const found = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const [best] = [...counts].toSorted(([a, many], [b, more]) => more - many || Math.abs(a) - Math.abs(b));

  return best === undefined || found * 2 < pixels ? null : best[0];
}

/** The offset of the nearest line where `steps` has a step of `sign` at `along`, from `line` out to EDGE_MAX_SHIFT. */
function nearestStep(
  steps: Steps,
  { line, along, sign }: { line: number; along: number; sign: number },
): number | null {
  if (along >= steps.span) {
    return null;
  }

  for (let distance = 0; distance <= EDGE_MAX_SHIFT; distance++) {
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
function stepsOf(image: RgbaImage, light: Float32Array, axis: "rows" | "columns"): Steps {
  const { width, height } = image;
  const rows = axis === "rows";
  const lines = rows ? height : width;
  const span = rows ? width : height;
  const at = (line: number, along: number) => light[rows ? line * width + along : along * width + line] ?? 0;
  const signs = new Int8Array(lines * span);

  for (let line = 1; line < lines; line++) {
    for (let along = 0; along < span; along++) {
      const step = at(line, along) - at(line - 1, along);

      signs[line * span + along] = step > EDGE_STEP ? 1 : step < -EDGE_STEP ? -1 : 0;
    }
  }

  return {
    lines,
    span,
    signs,
  };
}

/** Luminance 0–255 per pixel, over white where the image is transparent. */
function luminance(image: RgbaImage): Float32Array {
  const light = new Float32Array(image.width * image.height);

  for (let pixel = 0; pixel < light.length; pixel++) {
    const alpha = (image.data[pixel * 4 + 3] ?? 255) / 255;
    const over = (channel: number) => (image.data[pixel * 4 + channel] ?? 255) * alpha + 255 * (1 - alpha);

    light[pixel] = 0.2126 * over(0) + 0.7152 * over(1) + 0.0722 * over(2);
  }

  return light;
}

function countWhere(length: number, test: (index: number) => boolean): number {
  let count = 0;

  for (let index = 0; index < length; index++) {
    if (test(index)) {
      count += 1;
    }
  }

  return count;
}

/** The positions whose share passes the threshold, each run of neighbours kept once, at its strongest. */
function peaks(shares: readonly number[]): number[] {
  const found: number[] = [];
  let best = -1;
  let last = -2;

  for (let index = 0; index < shares.length; index++) {
    if ((shares[index] ?? 0) < EDGE_MIN_SHARE) {
      continue;
    }

    if (index !== last + 1) {
      if (best >= 0) {
        found.push(best);
      }

      best = index;
    } else if ((shares[index] ?? 0) > (shares[best] ?? 0)) {
      best = index;
    }

    last = index;
  }

  if (best >= 0) {
    found.push(best);
  }

  return found;
}
