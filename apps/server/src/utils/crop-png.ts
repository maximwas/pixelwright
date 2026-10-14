import { type DecodedPng, decode, encode } from "fast-png";

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

  const crop = new Crop(image, region);

  for (let y = 0; y < region.height; y++) {
    crop.copyRow(y);
  }

  return encode({
    width: region.width,
    height: region.height,
    channels: crop.channels,
    depth: image.depth,
    data: crop.data,
  });
}

/** A crop being made: the channels it keeps, its pixels so far, and the image's columns the region covers. */
class Crop {
  /** The image's own, or one more for an alpha when the region reaches past an image without one. */
  readonly channels: number;
  readonly data: Uint8Array | Uint16Array;
  readonly #image: DecodedPng;
  readonly #region: PixelRegion;
  readonly #opaque: number;
  readonly #left: number;
  readonly #right: number;

  constructor(image: DecodedPng, region: PixelRegion) {
    const inside =
      region.x >= 0 &&
      region.y >= 0 &&
      region.x + region.width <= image.width &&
      region.y + region.height <= image.height;
    const hasAlpha = image.channels === 2 || image.channels === 4;
    const channels = inside || hasAlpha ? image.channels : image.channels + 1;
    const size = region.width * region.height * channels;

    this.channels = channels;
    // Zeros: transparent wherever the image does not reach.
    this.data = image.data instanceof Uint16Array ? new Uint16Array(size) : new Uint8Array(size);
    this.#image = image;
    this.#region = region;
    this.#opaque = image.depth === 16 ? 0xff_ff : 0xff;
    this.#left = Math.max(0, region.x);
    this.#right = Math.min(image.width, region.x + region.width);
  }

  /** One row of the region: the image's pixels where it has them. */
  copyRow(y: number): void {
    const image = this.#image;
    const row = this.#region.y + y;

    if (row < 0 || row >= image.height || this.#left >= this.#right) {
      return;
    }

    const from = (row * image.width + this.#left) * image.channels;
    const to = (y * this.#region.width + this.#left - this.#region.x) * this.channels;

    if (this.channels === image.channels) {
      this.data.set(image.data.subarray(from, from + (this.#right - this.#left) * this.channels), to);
    } else {
      this.#copyWithAlpha(from, to);
    }
  }

  /** A row's pixels, each made opaque in the added alpha channel. */
  #copyWithAlpha(from: number, to: number): void {
    const image = this.#image;

    for (let x = 0; x < this.#right - this.#left; x++) {
      for (let channel = 0; channel < image.channels; channel++) {
        this.data[to + x * this.channels + channel] = image.data[from + x * image.channels + channel] ?? 0;
      }

      this.data[to + x * this.channels + image.channels] = this.#opaque;
    }
  }
}
