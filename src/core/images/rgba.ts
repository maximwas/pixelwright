import { InjectionToken, injectable } from "@needle-di/core";
import { PIXEL, RGBA_LAYOUT } from "@/core/images/images.constants.ts";
import type { PixelImage } from "@/core/ports/image-codec.port.ts";
import type { RgbaImage } from "@/core/ports/pixel-diff.port.ts";

/** Images as 8-bit RGBA, the form pixel comparisons (T-089) and the WebP encoder (S-095) take. */
@injectable()
export class Rgba {
  /**
   * The image as 8-bit RGBA, whatever its channels or depth (S-093): grey spread to RGB, an opaque alpha added where it
   * has none, 16 bits cut to 8, 1, 2 and 4 bits spread to 0-255.
   */
  of(image: PixelImage): RgbaImage {
    const { width, height, channels, depth, data } = image;

    if (channels === RGBA_LAYOUT.channels && depth === RGBA_LAYOUT.depth) {
      return { width, height, channels, depth, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
    }

    const rgba = new Uint8Array(width * height * RGBA_LAYOUT.channels);
    const sources = channels >= RGBA_LAYOUT.colours ? [0, 1, 2] : [0, 0, 0];
    const alpha = channels % 2 === 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const to = (y * width + x) * RGBA_LAYOUT.channels;

        for (const [channel, source] of sources.entries()) {
          rgba[to + channel] = this.#sample(image, y, x * channels + source);
        }

        rgba[to + RGBA_LAYOUT.colours] = alpha ? this.#sample(image, y, x * channels + channels - 1) : PIXEL.opaque;
      }
    }

    return { width, height, channels: RGBA_LAYOUT.channels, depth: RGBA_LAYOUT.depth, data: rgba };
  }

  /** The top left width × height of an image: the part two images of different sizes both cover. */
  topLeft(
    image: RgbaImage,
    width: number,
    height: number,
  ): RgbaImage {
    if (width === image.width && height === image.height) {
      return image;
    }

    const data = new Uint8Array(width * height * RGBA_LAYOUT.channels);
    const row = width * RGBA_LAYOUT.channels;

    for (let y = 0; y < height; y++) {
      const from = y * image.width * RGBA_LAYOUT.channels;

      data.set(image.data.subarray(from, from + row), y * row);
    }

    return { width, height, channels: RGBA_LAYOUT.channels, depth: RGBA_LAYOUT.depth, data };
  }

  /** One colour channel of a pixel laid over white: a transparent render and an opaque screenshot of a white page
   * compare alike (T-089). */
  overWhite(
    image: RgbaImage,
    pixel: number,
    channel: number,
  ): number {
    const at = pixel * RGBA_LAYOUT.channels;
    const alpha = (image.data[at + RGBA_LAYOUT.colours] ?? PIXEL.opaque) / PIXEL.opaque;

    return (image.data[at + channel] ?? PIXEL.white) * alpha + PIXEL.white * (1 - alpha);
  }

  /** One sample as 8 bits: a deeper one keeps its high byte; a shallower one (rows packed to whole bytes) is spread. */
  #sample(
    { width, channels, depth, data }: PixelImage,
    row: number,
    index: number,
  ): number {
    if (depth >= RGBA_LAYOUT.depth) {
      return (data[row * width * channels + index] ?? 0) >> (depth - RGBA_LAYOUT.depth);
    }

    const bit = index * depth;
    const top = 2 ** depth - 1;
    const rowBytes = Math.ceil((width * channels * depth) / RGBA_LAYOUT.depth);
    const byte = data[row * rowBytes + Math.floor(bit / RGBA_LAYOUT.depth)] ?? 0;

    return Math.round((((byte >> (RGBA_LAYOUT.depth - depth - (bit % RGBA_LAYOUT.depth))) & top) * PIXEL.opaque) / top);
  }
}

export const RGBA = new InjectionToken<Rgba>("Rgba");
