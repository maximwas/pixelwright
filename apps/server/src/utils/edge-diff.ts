// Adapted from Sitewright, the same author's MIT project (its apps/server/src/images/edge-diff.ts).
import { EDGE_LIST_MAX, EDGE_MAX_SHIFT, EDGE_MIN_SHARE, EDGE_STEP } from "../constants/images.ts";
import type { EdgeDiff, RgbaImage } from "../types/images.ts";

/**
 * Where lines and edges run across an image, by axis: `rows` holds the y of each horizontal edge (a hairline gives its
 * top and its bottom), `columns` the x of each vertical one. A row counts when enough of it changes luminance from the
 * row above; neighbouring rows of one soft edge count once, at the strongest.
 */
export function edgesOf(image: RgbaImage): { rows: number[]; columns: number[] } {
  const light = luminance(image);
  const { width, height } = image;
  const at = (x: number, y: number) => light[y * width + x] ?? 0;
  const rows = Array.from({ length: height }, (_, y) =>
    y === 0 ? 0 : countWhere(width, (x) => Math.abs(at(x, y) - at(x, y - 1)) > EDGE_STEP) / width,
  );
  const columns = Array.from({ length: width }, (_, x) =>
    x === 0 ? 0 : countWhere(height, (y) => Math.abs(at(x, y) - at(x - 1, y)) > EDGE_STEP) / height,
  );

  return {
    rows: peaks(rows),
    columns: peaks(columns),
  };
}

/** How the reference's edges along one axis pair with the render's: exact, shifted, missing or extra. */
export function diffEdges(reference: readonly number[], node: readonly number[]): EdgeDiff {
  const free = new Set(node);
  const shifted: { reference: number; node: number; by: number }[] = [];
  const missing: number[] = [];
  let matched = 0;

  for (const edge of reference) {
    const nearest = [...free].toSorted((a, b) => Math.abs(a - edge) - Math.abs(b - edge))[0];

    if (nearest === undefined || Math.abs(nearest - edge) > EDGE_MAX_SHIFT) {
      missing.push(edge);
      continue;
    }

    free.delete(nearest);

    if (nearest === edge) {
      matched += 1;
    } else {
      shifted.push({
        reference: edge,
        node: nearest,
        by: nearest - edge,
      });
    }
  }

  return {
    matched,
    shifted: shifted.slice(0, EDGE_LIST_MAX),
    missing: missing.slice(0, EDGE_LIST_MAX),
    extra: [...free].toSorted((a, b) => a - b).slice(0, EDGE_LIST_MAX),
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
