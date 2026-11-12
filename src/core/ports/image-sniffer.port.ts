import { InjectionToken } from "@needle-di/core";

/** What bytes are by their own header: the format (IMAGE_FORMAT) and the size in pixels. */
export interface SniffedImage {
  readonly format: string;
  readonly width: number;
  readonly height: number;
}

/** The real format and size of bytes, whatever a file name says; null for bytes no image format knows. */
export interface ImageSniffer {
  sniff(bytes: Uint8Array): SniffedImage | null;
}

export const IMAGE_SNIFFER = new InjectionToken<ImageSniffer>("ImageSniffer");
