/** The file's colour profile as Figma names it (LEGACY, SRGB, DISPLAY_P3), when this Figma gives one. */
export function colorProfile(): { colorProfile?: string } {
  const profile = (figma.root as { documentColorProfile?: string }).documentColorProfile;

  return typeof profile === "string" ? { colorProfile: profile } : {};
}
