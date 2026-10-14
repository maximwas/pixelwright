import { clampRgb, converter, modeP3, modeRgb, useMode } from "culori/fn";
import type { ColorSpace } from "../types/css.ts";
import { clampUnit } from "../utils/clamp.ts";
import { decimal } from "./format.ts";

useMode(modeRgb);
useMode(modeP3);

const toRgb = converter("rgb");
const toP3 = converter("p3");

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

/**
 * A Figma color (channels 0–1) as Dev Mode writes it: `#14161F`, `#000` when it shortens, `rgba()` when see-through.
 * In a Display P3 file the channels are P3 values: `color(display-p3 r g b)`, `/ a` when see-through.
 */
export function colorCss(color: Rgba, opacity = 1, space: ColorSpace = "srgb"): string {
  const alpha = (color.a ?? 1) * opacity;

  if (space === "display-p3") {
    const channels = [color.r, color.g, color.b].map((channel) => String(Math.round(channel * 10_000) / 10_000));

    return `color(display-p3 ${channels.join(" ")}${alpha < 1 ? ` / ${decimal(alpha)}` : ""})`;
  }

  if (alpha < 1) {
    const channels = [color.r, color.g, color.b].map((channel) => Math.round(channel * 255)).join(", ");

    return `rgba(${channels}, ${decimal(alpha)})`;
  }

  const digits = [color.r, color.g, color.b].map(hex);
  const short = digits.every((pair) => pair[0] === pair[1]);

  return `#${short ? digits.map((pair) => pair[0]).join("") : digits.join("")}`;
}

/** The colour space of a file by Figma's colour profile: Display P3, or sRGB (LEGACY and SRGB files, or none given). */
export function colorSpaceOf(profile: string | undefined): ColorSpace {
  return profile === "DISPLAY_P3" ? "display-p3" : "srgb";
}

/** A colour's sRGB channels: a Display P3 colour converted, clipped to what sRGB can show. */
export function srgbOf(color: Rgba, space: ColorSpace = "srgb"): Rgba {
  if (space === "srgb") {
    return color;
  }

  const { r, g, b } = clampRgb(
    toRgb({
      mode: "p3",
      r: color.r,
      g: color.g,
      b: color.b,
    }),
  );

  return {
    r,
    g,
    b,
    ...(color.a === undefined ? {} : { a: color.a }),
  };
}

/**
 * A colour design_apply was given, in the document's own space: in a Display P3 file a P3 colour as it is and an sRGB
 * one converted to P3; in an sRGB file a P3 colour converted and clipped, an sRGB one as it is.
 */
export function toDocumentColor(
  color: Rgba & { readonly space?: "display-p3" },
  document: ColorSpace,
): { r: number; g: number; b: number; a: number } {
  const a = color.a ?? 1;

  if (document === "display-p3" && color.space !== "display-p3") {
    const { r, g, b } = toP3({
      mode: "rgb",
      r: color.r,
      g: color.g,
      b: color.b,
    });

    return {
      r: clampUnit(r),
      g: clampUnit(g),
      b: clampUnit(b),
      a,
    };
  }

  const { r, g, b } = document === "srgb" && color.space === "display-p3" ? srgbOf(color, "display-p3") : color;

  return {
    r,
    g,
    b,
    a,
  };
}
