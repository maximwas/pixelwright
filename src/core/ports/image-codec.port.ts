import { InjectionToken } from "@needle-di/core";

/** An image's pixels, row by row: 1 to 4 channels (grey, grey and alpha, RGB, RGBA), each of `depth` bits. */
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly depth: number;
  readonly data: Uint8Array | Uint8ClampedArray | Uint16Array;
}

/** PNG bytes to pixels and back; an indexed PNG comes out as its colours. */
export interface ImageCodec {
  decode(png: Uint8Array): PixelImage;
  encode(image: PixelImage): Uint8Array;
}

export const IMAGE_CODEC = new InjectionToken<ImageCodec>("ImageCodec");
