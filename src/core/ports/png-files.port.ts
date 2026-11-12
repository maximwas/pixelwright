import { InjectionToken } from "@needle-di/core";

/**
 * Where screenshots are saved (T-072, D-14): only .png paths, never over a file that is not a PNG; and where a PNG to
 * compare with is read (T-089).
 */
export interface PngFiles {
  /** The path, when a PNG may be written there: refused when it is not .png or holds a file that is not a PNG. */
  check(path: string): Promise<string>;
  /** Writes the PNG after the same check, its folder made; an earlier screenshot is replaced. */
  write(path: string, png: Uint8Array): Promise<void>;
  /** A PNG to compare with: refused when no file is there, it is over 50 MB, or its bytes are not a PNG. */
  read(path: string): Promise<Uint8Array>;
}

export const PNG_FILES = new InjectionToken<PngFiles>("PngFiles");
