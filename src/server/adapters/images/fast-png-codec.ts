import { injectable } from "@needle-di/core";
import { type BitDepth, convertIndexedToRgb, decode, encode } from "fast-png";
import type { ImageCodec, PixelImage } from "@/core/ports/image-codec.port.ts";

/** PNGs through fast-png 8: an indexed PNG (Figma writes one for an image of few colours) comes out as its colours. */
@injectable()
export class FastPngCodec implements ImageCodec {
  decode(png: Uint8Array): PixelImage {
    const image = decode(png);

    if (image.palette === undefined) {
      return image;
    }

    const data = convertIndexedToRgb(image);

    return {
      width: image.width,
      height: image.height,
      channels: data.length / (image.width * image.height),
      depth: 8,
      data,
    };
  }

  encode({ width, height, channels, depth, data }: PixelImage): Uint8Array {
    return encode({ width, height, channels, depth: depth as BitDepth, data });
  }
}
