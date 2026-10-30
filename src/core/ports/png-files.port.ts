import { InjectionToken } from "@needle-di/core";

/** Where screenshots are saved (T-072, D-14): only .png paths, never over a file that is not a PNG. */
export interface PngFiles {
  /** The path, when a PNG may be written there: refused when it is not .png or holds a file that is not a PNG. */
  check(path: string): Promise<string>;
  /** Writes the PNG after the same check, its folder made; an earlier screenshot is replaced. */
  write(path: string, png: Uint8Array): Promise<void>;
}

export const PNG_FILES = new InjectionToken<PngFiles>("PngFiles");
