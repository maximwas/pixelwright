import { InjectionToken } from "@needle-di/core";

/** The families Google Fonts serves, each with its weights as design_read writes them ("400", "400 italic"), or why
 * they could not be read. */
export type ServedFonts =
  | { readonly families: ReadonlyMap<string, readonly string[]>; readonly error: null }
  | { readonly families: null; readonly error: string };

/** Where fonts_check learns what Google Fonts serves (T-101, A§15.5): it never throws, offline is an error said. */
export interface FontDirectory {
  families(): Promise<ServedFonts>;
}

export const FONT_DIRECTORY = new InjectionToken<FontDirectory>("FontDirectory");

/** The directory asked when the first cannot be read. */
export const FONT_DIRECTORY_FALLBACK = new InjectionToken<FontDirectory>("FontDirectoryFallback");
