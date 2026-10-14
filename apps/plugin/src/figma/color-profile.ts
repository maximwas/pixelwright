import { Color, type ColorValue, colorSpaceOf } from "@pixelwright/core";

/** The file's colour profile as Figma names it (LEGACY, SRGB, DISPLAY_P3), when this Figma gives one. */
export function colorProfile(): { colorProfile?: string } {
  const profile = (figma.root as { documentColorProfile?: string }).documentColorProfile;

  return typeof profile === "string" ? { colorProfile: profile } : {};
}

/** A colour design_apply or tokens_apply was given, in this document's own space (sRGB, or Display P3). */
export function documentColor(color: ColorValue): { r: number; g: number; b: number; a: number } {
  return Color.fromValue(color).to(colorSpaceOf(colorProfile().colorProfile)).channels();
}
