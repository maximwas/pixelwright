/** What tokens_bind binds (K-029): colours, numbers (spacing, radii, border widths, opacity), text styles, effects. */
export const BIND_KIND = { color: "color", number: "number", text: "text", effect: "effect" } as const;

/** Where a raw solid paint sits: a layer's fills or strokes, or a run of a text whose fills differ by run. */
export const BIND_PAINT_AT = { fills: "fills", strokes: "strokes", run: "run" } as const;

/** The field a planned bind's kind sits in. */
export const BIND_KIND_FIELD = "kind";

/** What a token to bind is: a variable, or a style. */
export const BIND_SOURCE = { variable: "variable", style: "style" } as const;

/** Where the scan looks besides a layer or page: every page. */
export const BIND_WITHIN = { file: "file" } as const;

/**
 * The number fields the scan reads, in Figma's names (K-027): spacing, padding and opacity alone; radii and border
 * widths as their four corners or sides, or the one field of a layer that has no four (cornerRadius, strokeWeight).
 */
export const BIND_NUMBER_FIELDS = [
  "itemSpacing",
  "counterAxisSpacing",
  "gridRowGap",
  "gridColumnGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "opacity",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomRightRadius",
  "bottomLeftRadius",
] as const;

/** Border widths, read only where the layer draws a stroke: Figma gives every shape a weight of 1 by default. */
export const BIND_STROKE_FIELDS = [
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

/** The layout fields a gap or a padding counts by (K-027). */
export const BIND_LAYOUT_FIELDS = ["layoutMode", "primaryAxisAlignItems", "layoutWrap"] as const;

export const BIND_LIMIT = {
  /** 0.7.0's cap on remaps in one call. */
  maxRemaps: 50,
  /** Ids a remap list names: each from token names a style and a variable at most. */
  maxSources: 100,
  /** Layers in one scan: one layer's raw values take well under 1 KB, so the answer stays far under a 4 MiB frame. */
  maxLayers: 2_000,
} as const;
