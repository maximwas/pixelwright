/** A number variable scoped only to these is a length: a DTCG `dimension` in px. */
export const DTCG_DIMENSION_SCOPES: ReadonlySet<string> = new Set([
  "WIDTH_HEIGHT",
  "GAP",
  "CORNER_RADIUS",
  "STROKE_FLOAT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
  "EFFECT_FLOAT",
]);

/** Effects DTCG has a type for: shadows; `inset` for an inner one. */
export const DTCG_SHADOWS: Readonly<Record<string, boolean>> = {
  DROP_SHADOW: false,
  INNER_SHADOW: true,
};

/** The line height DTCG gets for Figma's Auto: CSS's `normal`, about 1.2× the font size for most fonts. */
export const DTCG_AUTO_LINE_HEIGHT = 1.2;

/** The key of a group's own token, when a token's path is also a group (DTCG 2025.10). */
export const DTCG_ROOT = "$root";

/** The key of the DTCG tree that holds the styles; a collection of that name gets another. */
export const DTCG_STYLES = "styles";
