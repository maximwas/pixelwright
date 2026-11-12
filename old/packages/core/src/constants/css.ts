/**
 * Layer types drawn as SVG, whose fills and strokes are the vector's own, not a box's background and border: shapes,
 * and Figma Draw's transform groups, which CSS cannot draw.
 */
export const VECTOR_TYPES: ReadonlySet<string> = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "POLYGON",
  "TRANSFORM_GROUP",
]);

/** Layer types that hold text: a text, and Figma Draw's text on a path, whose text reads as a text's. */
export const TEXT_TYPES: ReadonlySet<string> = new Set(["TEXT", "TEXT_PATH"]);

/** The spacing grid a design's gaps, padding and radii are checked against, in px. */
export const SPACING_GRID = 4;

/**
 * CSS's blur() per px of Figma's blur radius: Figma renders a radius R as a Gaussian of about 0.43 R (measured on
 * layer and background blurs of radius 4 to 40 against Chrome), so blur(0.43 R) looks like it; Dev Mode's R / 2 is
 * softer.
 */
export const BLUR_PER_RADIUS = 0.43;

/**
 * A variable font's registered axes at the value a browser draws without being told (upright, not italic, normal
 * width): writing them says nothing. Weight and optical size depend on the text: text CSS compares them with its
 * weight and size.
 */
export const DEFAULT_FONT_AXES: Readonly<Record<string, number>> = {
  slnt: 0,
  ital: 0,
  wdth: 100,
};
