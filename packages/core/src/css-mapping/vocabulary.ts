/** The CSS attributes the mapping reads and writes, and which elements take which. */

/**
 * The order CSS attributes are written in, so every read of a layer reads the same: layout, position, size, spacing,
 * alignment, transform, paint, border, radius, effects, text.
 */
export const CSS_ORDER = [
  "display",
  "flex-direction",
  "flex-wrap",
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "flex",
  "align-self",
  "grid-row",
  "grid-column",
  "justify-self",
  "padding",
  "justify-content",
  "align-items",
  "align-content",
  "gap",
  "column-gap",
  "row-gap",
  "grid-template-columns",
  "grid-template-rows",
  "transform",
  "opacity",
  "overflow",
  "text-overflow",
  "white-space",
  "border-radius",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  "background",
  "box-shadow",
  "text-shadow",
  "filter",
  "backdrop-filter",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-underline-offset",
  "text-decoration-thickness",
  "text-align",
  "text-wrap",
  "color",
] as const;

/** CSS attributes the mapping table reads and writes. */
export const CSS_ATTRIBUTES: ReadonlySet<string> = new Set(CSS_ORDER);

/** What a run of text (`<Span>`) may set. */
export const SPAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  "textStyle",
  "href",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-underline-offset",
  "text-decoration-thickness",
  "color",
]);

/** A frame's own layout, auto layout or grid (display is checked by its value). */
export const LAYOUT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "flex-direction",
  "flex-wrap",
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "justify-content",
  "align-items",
  "align-content",
  "grid-template-columns",
  "grid-template-rows",
]);

/** What only a Text takes (its spans the run ones). */
export const TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "textStyle",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-underline-offset",
  "text-decoration-thickness",
  "text-align",
  "text-wrap",
  "color",
  "text-overflow",
  "white-space",
]);

/** A box's own paint, which a Text, a Line and a Group do not have. */
export const BOX_PAINT: ReadonlySet<string> = new Set([
  "background",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  "border-radius",
  "box-shadow",
]);

/** Tags whose layers can hold a layout of their own. */
export const LAYOUT_TAGS: ReadonlySet<string> = new Set(["Frame", "Component", "ComponentSet", "Instance", "Slot"]);
