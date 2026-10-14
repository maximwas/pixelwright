/**
 * Layer types drawn as SVG, whose fills and strokes are the vector's own, not a box's background and border: shapes,
 * and Figma Draw's text on a path and transform groups, which CSS cannot draw.
 */
export const VECTOR_TYPES: ReadonlySet<string> = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "POLYGON",
  "TEXT_PATH",
  "TRANSFORM_GROUP",
]);

/** Paints CSS cannot draw: a leaf filled with one is rendered as an image (gradients stay CSS, read-only for now). */
export const RENDERED_PAINTS: ReadonlySet<string> = new Set(["VIDEO", "PATTERN", "SHADER"]);

/** Effects CSS cannot draw: a leaf with one is rendered as an image. */
export const RENDERED_EFFECTS: ReadonlySet<string> = new Set(["NOISE", "TEXTURE", "GLASS", "SHADER"]);

/** Layer types design_read leaves out: they draw nothing. */
export const INVISIBLE_TYPES: ReadonlySet<string> = new Set(["SLICE"]);

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

/** design_read's `$dev` for what the designer marked in Dev Mode. */
export const DEV_STATUS_WORDS: Readonly<Record<string, string>> = {
  ready: "ready for dev",
  completed: "completed",
};
