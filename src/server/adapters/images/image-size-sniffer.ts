import { injectable } from "@needle-di/core";
import { imageSize } from "image-size";
import type { ImageSniffer, SniffedImage } from "@/core/ports/image-sniffer.port.ts";

/** The real format and size of bytes, by image-size 2 reading their header. */
@injectable()
export class ImageSizeSniffer implements ImageSniffer {
  sniff(bytes: Uint8Array): SniffedImage | null {
    try {
      const { type, width, height } = imageSize(bytes);

      return type === undefined ? null : { format: type, width, height };
    } catch {
      // Not an image image-size knows, or its header is cut short.
      return null;
    }
  }
}
