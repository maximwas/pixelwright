import { InjectionToken } from "@needle-di/core";
import type { PixelImage } from "@/core/ports/image-codec.port.ts";

/** An image as 8-bit RGBA: four bytes a pixel, row by row. */
export interface RgbaImage extends PixelImage {
  readonly data: Uint8Array;
}

/** A box of pixels, from its top left. */
export interface PixelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** How two images of one size differ, pixel by pixel. */
export interface PixelDifference {
  /** The pixels that differ by more than antialiasing does. */
  readonly count: number;
  /** The box around them; null when none differs. */
  readonly box: PixelBox | null;
  /** The render faded, every differing pixel red. */
  readonly image: RgbaImage;
}

/** Two images of one size compared pixel by pixel, both laid over white (T-089, A§15.7). */
export interface PixelDiff {
  compare(node: RgbaImage, reference: RgbaImage): PixelDifference;
}

export const PIXEL_DIFF = new InjectionToken<PixelDiff>("PixelDiff");
