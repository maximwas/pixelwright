import { InjectionToken, injectable } from "@needle-di/core";

/** Bytes as base64 for the bridge, by Figma's own encoder: the plugin's main thread has no btoa. */
@injectable()
export class FigmaBase64 {
  encode(bytes: Uint8Array): string {
    return figma.base64Encode(bytes);
  }
}

export const FIGMA_BASE64 = new InjectionToken<FigmaBase64>("FigmaBase64");
