import { decimal } from "./format.ts";

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number | undefined;
}

const hex = (channel: number) =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/** A Figma color (channels 0–1) as Dev Mode writes it: `#14161F`, `#000` when it shortens, `rgba()` when see-through. */
export function colorCss(color: Rgba, opacity = 1): string {
  const alpha = (color.a ?? 1) * opacity;

  if (alpha < 1) {
    const channels = [color.r, color.g, color.b].map((channel) => Math.round(channel * 255)).join(", ");

    return `rgba(${channels}, ${decimal(alpha)})`;
  }

  const digits = [color.r, color.g, color.b].map(hex);
  const short = digits.every((pair) => pair[0] === pair[1]);

  return `#${short ? digits.map((pair) => pair[0]).join("") : digits.join("")}`;
}
