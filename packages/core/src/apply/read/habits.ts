/**
 * Attributes agents write out of habit, Figma's or SVG's names for what CSS says otherwise, and the CSS that writes
 * the same: a closer hint than the nearest spelling ("x" is not "id").
 */
const HABITS: Readonly<Record<string, (value: string) => string>> = {
  x: (value) => `Write position="absolute" left="${pixels(value)}": CSS places a layer by left and top.`,
  y: (value) => `Write position="absolute" top="${pixels(value)}": CSS places a layer by left and top.`,
  fill: (value) => `Write background="${value}" (color on a Text).`,
  stroke: (value) => `Write border="1px solid ${value}".`,
  rotation: (value) => `Write transform="rotate(${/^-?\d*\.?\d+$/.test(value) ? `${value}deg` : value})".`,
  "corner-radius": (value) => `Write border-radius="${pixels(value)}".`,
  cornerRadius: (value) => `Write border-radius="${pixels(value)}".`,
};

/** A bare number as px, anything else as given. */
function pixels(value: string): string {
  return /^-?\d*\.?\d+$/.test(value.trim()) ? `${value.trim()}px` : value;
}

/** The CSS for an attribute written out of habit, or undefined for any other. */
export function habitHint(name: string, value: string): string | undefined {
  return Object.hasOwn(HABITS, name) ? HABITS[name]?.(value) : undefined;
}
