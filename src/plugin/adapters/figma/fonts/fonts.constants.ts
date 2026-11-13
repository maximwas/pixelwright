/** The font createText() and createTextPath() start a text in (FX-040): loaded before its characters are set. */
export const NEW_TEXT_FONT = { family: "Inter", style: "Regular" } as const;

/** The segment fields that tell the font a text uses and the weight Figma reports for it. */
export const FONT_FIELDS = ["fontName", "fontWeight"] as const;

export const FONT_NUMBER = {
  /** Variable fonts report weights like 590, so a style within 50 of the asked weight is that weight (P-077). */
  nearWeight: 50,
} as const;

export const FONT_PATTERN = {
  slanted: /italic|oblique/i,
  /** A plain style comes first at an equal distance: Regular before Book. */
  plain: /^(regular|italic|normal)$/i,
} as const;

export const FONT_TEXT = {
  key: (family: string, style: string) => `${family} ${style}`,
  specKey: (
    family: string,
    weight: number,
    italic: boolean,
  ) =>
    `${family.toLowerCase()} ${weight}${italic ? " italic" : ""}`,
  noFamily: (family: string) => `Figma has no font family ${family}.`,
  near: (near: string) => `Did you mean ${near}?`,
  install: "Install it, or use a family the file has.",
  noWeight: (
    family: string,
    weight: number,
    italic: boolean,
    styles: readonly string[],
  ) =>
    `${family} has no weight ${weight}${italic ? " italic" : ""}: it has ${styles.join(", ")}.`,
} as const;
