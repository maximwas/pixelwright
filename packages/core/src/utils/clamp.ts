/** A colour channel or alpha held to Figma's range, 0 to 1. */
export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
