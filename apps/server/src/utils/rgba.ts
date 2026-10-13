import type { DecodedPng } from "fast-png";
import type { RgbaImage } from "../types/images.ts";

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
