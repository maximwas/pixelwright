import { decode, encode } from "fast-png";

/** A region of a PNG, in its pixels. */
export interface PixelRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The region of a PNG as a PNG of its own; what lies outside the image comes out transparent (an alpha channel is added
 * when the image has none). Null for an empty region.
 */
export function cropPng(png: Uint8Array, region: PixelRegion): Uint8Array | null {
  if (region.width < 1 || region.height < 1) {
    return null;
  }

  const image = decode(png);

  if (image.palette !== undefined) {
    throw new Error(
      "Figma's export is an indexed PNG, which cannot be cropped here: take the screenshot without clip.",
    );
  }

  const inside =
    region.x >= 0 &&
    region.y >= 0 &&
    region.x + region.width <= image.width &&
    region.y + region.height <= image.height;
  const hasAlpha = image.channels === 2 || image.channels === 4;
  const channels = inside || hasAlpha ? image.channels : image.channels + 1;
  const size = region.width * region.height * channels;
  // Zeros: transparent wherever the image does not reach.
  const data = image.data instanceof Uint16Array ? new Uint16Array(size) : new Uint8Array(size);
  const opaque = image.depth === 16 ? 0xff_ff : 0xff;
  const left = Math.max(0, region.x);
  const right = Math.min(image.width, region.x + region.width);

  for (let y = 0; y < region.height; y++) {
    const row = region.y + y;

    if (row < 0 || row >= image.height || left >= right) {
      continue;
    }

    const from = (row * image.width + left) * image.channels;
    const to = (y * region.width + left - region.x) * channels;

    if (channels === image.channels) {
      data.set(image.data.subarray(from, from + (right - left) * channels), to);
      continue;
    }

    for (let x = 0; x < right - left; x++) {
      for (let channel = 0; channel < image.channels; channel++) {
        data[to + x * channels + channel] = image.data[from + x * image.channels + channel] ?? 0;
      }

      data[to + x * channels + image.channels] = opaque;
    }
  }

  return encode({
    width: region.width,
    height: region.height,
    channels,
    depth: image.depth,
    data,
  });
}
