import type { DecodedPng } from "fast-png";
import { PIXEL_TOLERANCE } from "../constants/images.ts";
import type { ImageComparison, RgbaImage } from "../types/images.ts";
import { diffEdges, edgesOf } from "./edge-diff.ts";

/** A decoded PNG as 8-bit RGBA, whatever its channels, depth or palette. */
export function toRgba(png: DecodedPng): RgbaImage {
  const { width, height, channels, palette } = png;
  const data = new Uint8Array(width * height * 4);
  const shift = png.depth === 16 ? 8 : 0;
  const sample = (index: number) => (png.data[index] ?? 0) >> shift;

  for (let pixel = 0; pixel < width * height; pixel++) {
    let rgba: number[];

    if (palette !== undefined) {
      const entry = palette[sample(pixel)] ?? [0, 0, 0];

      rgba = [entry[0] ?? 0, entry[1] ?? 0, entry[2] ?? 0, entry[3] ?? 255];
    } else if (channels <= 2) {
      const gray = sample(pixel * channels);

      rgba = [gray, gray, gray, channels === 2 ? sample(pixel * 2 + 1) : 255];
    } else {
      const at = pixel * channels;

      rgba = [sample(at), sample(at + 1), sample(at + 2), channels === 4 ? sample(at + 3) : 255];
    }

    data.set(rgba, pixel * 4);
  }

  return {
    width,
    height,
    data,
  };
}

/**
 * The render against the reference: pixel by pixel over the part both cover (from the top left), both laid over
 * white so a transparent render and an opaque screenshot of a white page compare alike; and by their edges.
 */
export function compareImages(node: RgbaImage, reference: RgbaImage): ImageComparison {
  const width = Math.min(node.width, reference.width);
  const height = Math.min(node.height, reference.height);
  let squares = 0;
  let different = 0;
  let box: { left: number; top: number; right: number; bottom: number } | null = null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = overWhite(node, x, y);
      const b = overWhite(reference, x, y);
      const deltas = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

      squares += deltas.reduce((sum, delta) => sum + delta * delta, 0) / 3;

      if (Math.max(...deltas.map(Math.abs)) > PIXEL_TOLERANCE) {
        different += 1;
        box =
          box === null
            ? {
                left: x,
                top: y,
                right: x,
                bottom: y,
              }
            : {
                left: Math.min(box.left, x),
                top: Math.min(box.top, y),
                right: Math.max(box.right, x),
                bottom: Math.max(box.bottom, y),
              };
      }
    }
  }

  const pixels = Math.max(1, width * height);
  const ours = edgesOf(node);
  const theirs = edgesOf(reference);

  return {
    rmse: Math.round(Math.sqrt(squares / pixels) * 100) / 100,
    different: different / pixels,
    box:
      box === null
        ? null
        : {
            x: box.left,
            y: box.top,
            width: box.right - box.left + 1,
            height: box.bottom - box.top + 1,
          },
    rows: diffEdges(theirs.rows, ours.rows),
    columns: diffEdges(theirs.columns, ours.columns),
  };
}

/** The part both cover: the render faded toward white, every differing pixel red. */
export function differenceImage(node: RgbaImage, reference: RgbaImage): RgbaImage {
  const width = Math.min(node.width, reference.width);
  const height = Math.min(node.height, reference.height);
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = overWhite(node, x, y);
      const b = overWhite(reference, x, y);
      const differs = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) > PIXEL_TOLERANCE;
      const faded = (value: number) => Math.round(value * 0.3 + 255 * 0.7);

      data.set(differs ? [255, 0, 0, 255] : [faded(a[0]), faded(a[1]), faded(a[2]), 255], (y * width + x) * 4);
    }
  }

  return {
    width,
    height,
    data,
  };
}

function overWhite(image: RgbaImage, x: number, y: number): [number, number, number] {
  const at = (y * image.width + x) * 4;
  const alpha = (image.data[at + 3] ?? 255) / 255;
  const over = (channel: number) => (image.data[at + channel] ?? 255) * alpha + 255 * (1 - alpha);

  return [over(0), over(1), over(2)];
}
