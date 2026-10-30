import { InjectionToken, injectable } from "@needle-di/core";
import { PIXEL } from "@/core/images/images.constants.ts";
import type { PixelImage } from "@/core/ports/image-codec.port.ts";

/** A region of an image, in its pixels; it may reach past the image's edges. */
export interface PixelRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A crop being made: the image, the region, the crop's channels and pixels, and the image's columns it covers. */
interface Cut {
  readonly image: PixelImage;
  readonly region: PixelRegion;
  readonly channels: number;
  readonly data: Uint8Array | Uint16Array;
  readonly left: number;
  readonly right: number;
}

/**
 * A region of an image as an image of its own (T-073): what lies outside the image comes out transparent, an alpha
 * channel added when the image has none. The region is at least a pixel each way.
 */
@injectable()
export class Crop {
  region(image: PixelImage, region: PixelRegion): PixelImage {
    const inside =
      region.x >= 0 &&
      region.y >= 0 &&
      region.x + region.width <= image.width &&
      region.y + region.height <= image.height;
    const alpha = image.channels === 2 || image.channels === 4;
    const channels = inside || alpha ? image.channels : image.channels + 1;
    const size = region.width * region.height * channels;
    // Zeros: transparent wherever the image does not reach.
    const data = image.data instanceof Uint16Array ? new Uint16Array(size) : new Uint8Array(size);
    const cut = {
      image,
      region,
      channels,
      data,
      left: Math.max(0, region.x),
      right: Math.min(image.width, region.x + region.width),
    };

    for (let y = 0; y < region.height; y++) {
      this.#copyRow(cut, y);
    }

    return { width: region.width, height: region.height, channels, depth: image.depth, data };
  }

  /** One row of the region: the image's pixels where it has them, each made opaque in an added alpha channel. */
  #copyRow({ image, region, channels, data, left, right }: Cut, y: number): void {
    const row = region.y + y;

    if (row < 0 || row >= image.height || left >= right) {
      return;
    }

    const from = (row * image.width + left) * image.channels;
    const to = (y * region.width + left - region.x) * channels;

    if (channels === image.channels) {
      data.set(image.data.subarray(from, from + (right - left) * channels), to);

      return;
    }

    const opaque = image.depth === PIXEL.deepBits ? PIXEL.opaqueDeep : PIXEL.opaque;

    for (let x = 0; x < right - left; x++) {
      for (let channel = 0; channel < image.channels; channel++) {
        data[to + x * channels + channel] = image.data[from + x * image.channels + channel] ?? 0;
      }

      data[to + x * channels + image.channels] = opaque;
    }
  }
}

export const CROP = new InjectionToken<Crop>("Crop");
