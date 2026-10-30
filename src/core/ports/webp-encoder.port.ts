import { InjectionToken } from "@needle-di/core";

/** PNG bytes as WebP (S-095): the transparency kept exactly, quality (1 to 100) setting how lossy the colours are. */
export interface WebpEncoder {
  encode(png: Uint8Array, quality: number): Promise<Uint8Array>;
}

export const WEBP_ENCODER = new InjectionToken<WebpEncoder>("WebpEncoder");
