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

/** A variable font axis's range and default, as a family's catalogue gives them. */
export interface FontAxis {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/**
 * Where a family's axis ranges come from (Plugin API 138 names a family's axes but not their ranges): its axes by tag,
 * or null for a static family, one the catalogue lacks, or a catalogue that cannot be read. It never throws.
 */
export interface FontAxesDirectory {
  axes(family: string): Promise<Readonly<Record<string, FontAxis>> | null>;
}

export const FONT_AXES = new InjectionToken<FontAxesDirectory>("FontAxesDirectory");
