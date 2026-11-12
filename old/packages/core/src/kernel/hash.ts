/** FNV-1a, in base 36: short, stable, good enough to keep a few odd names or drawings apart. */
export function fnv1a(text: string): string {
  let value = 0x811c9dc5;

  for (const char of text) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 0x01000193) >>> 0;
  }

  return value.toString(36);
}
