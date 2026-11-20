import { InjectionToken, injectable } from "@needle-di/core";

/** Bytes as base64 for the bridge and back, by Figma's own coder: the plugin's main thread has no btoa or atob. */
@injectable()
export class FigmaBase64 {
  encode(bytes: Uint8Array): string {
    return figma.base64Encode(bytes);
  }

  decode(text: string): Uint8Array {
    return figma.base64Decode(text);
  }
}

export const FIGMA_BASE64 = new InjectionToken<FigmaBase64>("FigmaBase64");
