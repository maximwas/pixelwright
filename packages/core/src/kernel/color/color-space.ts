/** The colour spaces Figma files hold colours in: sRGB, or Display P3. */
export type ColorSpace = "srgb" | "display-p3";

/** The colour space of a file by Figma's colour profile: Display P3, or sRGB (LEGACY and SRGB files, or none given). */
export function colorSpaceOf(profile: string | undefined): ColorSpace {
  return profile === "DISPLAY_P3" ? "display-p3" : "srgb";
}
