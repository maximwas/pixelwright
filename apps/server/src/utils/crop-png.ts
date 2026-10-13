import { decode, encode } from "fast-png";

/** A region of a PNG, in its pixels. */
export interface PixelRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The region of a PNG as a PNG of its own; null when the region does not lie within the image. */
export function cropPng(png: Uint8Array, region: PixelRegion): Uint8Array | null {
  const image = decode(png);

  if (
    region.x < 0 ||
    region.y < 0 ||
    region.width < 1 ||
    region.height < 1 ||
    region.x + region.width > image.width ||
    region.y + region.height > image.height
  ) {
    return null;
  }

  if (image.palette !== undefined) {
    throw new Error(
      "Figma's export is an indexed PNG, which cannot be cropped here: take the screenshot without clip.",
    );
  }

  const samples = image.channels;
  const size = region.width * region.height * samples;
  const data = image.data instanceof Uint16Array ? new Uint16Array(size) : new Uint8Array(size);
  const row = region.width * samples;

  for (let y = 0; y < region.height; y++) {
    const from = ((region.y + y) * image.width + region.x) * samples;

    data.set(image.data.subarray(from, from + row), y * row);
  }

  return encode({
    width: region.width,
    height: region.height,
    channels: image.channels,
    depth: image.depth,
    data,
  });
}
