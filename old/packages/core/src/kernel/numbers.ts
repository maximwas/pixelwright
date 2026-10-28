/** A number rounded to `places` decimals, away from floating-point noise (0.07em is 7.000000000000001 percent); never -0. */
export function roundTo(value: number, places: number): number {
  const scale = 10 ** places;

  return Math.round(value * scale) / scale + 0;
}

/** A number with at most two decimals, as CSS gets it. */
export function decimal(value: number): string {
  return String(roundTo(value, 2));
}

/** A colour channel or alpha held to Figma's range, 0 to 1. */
export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
