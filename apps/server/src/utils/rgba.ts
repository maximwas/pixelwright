import { convertIndexedToRgb, type DecodedPng } from "fast-png";
import type { RgbaImage } from "../types/images.ts";

/** A decoded PNG as 8-bit RGBA, whatever its channels, bit depth or palette. */
export function toRgba(png: DecodedPng): RgbaImage {
  const { width, height } = png;

  if (png.palette !== undefined) {
    const rgb = convertIndexedToRgb(png);
    const channels = rgb.length / (width * height);

    return {
      width,
      height,
      data: widen(rgb, {
        channels,
        depth: 8,
        width,
        height,
      }),
    };
  }

  return {
    width,
    height,
    data: widen(png.data, {
      channels: png.channels,
      depth: png.depth,
      width,
      height,
    }),
  };
}

/** How a PNG's samples lie: channels a pixel, bits a sample, and the image's size. */
interface SampleLayout {
  readonly channels: number;
  readonly depth: number;
  readonly width: number;
  readonly height: number;
}

/** Samples of any depth (1, 2, 4, 8 or 16 bits, rows packed to whole bytes) as 8-bit RGBA. */
function widen(data: ArrayLike<number>, { channels, depth, width, height }: SampleLayout): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const top = 2 ** Math.min(depth, 8) - 1;
  const sample = (row: number, index: number): number => {
    if (depth === 16) {
      return (data[row * width * channels + index] ?? 0) >> 8;
    }

    if (depth === 8) {
      return data[row * width * channels + index] ?? 0;
    }

    const bit = index * depth;
    const byte = data[row * rowBytes + (bit >> 3)] ?? 0;

    return Math.round((((byte >> (8 - depth - (bit & 7))) & top) * 255) / top);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = x * channels;
      const value = (channel: number) => sample(y, at + channel);
      const rgba =
        channels <= 2
          ? [value(0), value(0), value(0), channels === 2 ? value(1) : 255]
          : [value(0), value(1), value(2), channels === 4 ? value(3) : 255];

      out.set(rgba, (y * width + x) * 4);
    }
  }

  return out;
}
