/** How far a length other than a size or a place may be off: a computed style holds it as written, in px. */
export const LENGTH_PRECISION = 0.05;

/** An 8-bit step and a half for each channel: hex and rgb() hold 8 bits, and either side may round. */
export const COLOR_PRECISION = 1.5 / 255;

/** A value's words as compared: lower case, one space between them, no quotes. */
export function wordsOf(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/["']/g, "").toLowerCase();
}
