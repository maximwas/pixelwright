import { injectable } from "@needle-di/core";
import pixelmatch from "pixelmatch";
import { RGBA_LAYOUT } from "@/core/images/images.constants.ts";
import type { PixelBox, PixelDiff, PixelDifference, RgbaImage } from "@/core/ports/pixel-diff.port.ts";
import { PIXELMATCH } from "@/server/adapters/images/images.constants.ts";

/**
 * Pixels compared through pixelmatch 8.0.0 (A§15.7): its perceptual threshold and its antialiasing detection count
 * the pixels that differ, where 0.7.0 counted any channel off by more than 16, so the count moved once. The difference
 * is the render faded, every differing pixel red, an antialiased one yellow.
 */
@injectable()
export class PixelmatchDiff implements PixelDiff {
  compare(node: RgbaImage, reference: RgbaImage): PixelDifference {
    const { width, height } = node;
    const data = new Uint8Array(width * height * RGBA_LAYOUT.channels);
    const count = pixelmatch(node.data, reference.data, data, width, height, PIXELMATCH.options);
    const image = { width, height, channels: RGBA_LAYOUT.channels, depth: RGBA_LAYOUT.depth, data };

    return { count, box: count === 0 ? null : this.#box(image), image };
  }

  /** The box around the pixels the difference paints red. */
  #box({ width, height, data }: RgbaImage): PixelBox | null {
    let [left, top, right, bottom] = [width, height, -1, -1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * RGBA_LAYOUT.channels;

        if (PIXELMATCH.red.every((value, channel) => data[at + channel] === value)) {
          [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
        }
      }
    }

    return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
}
