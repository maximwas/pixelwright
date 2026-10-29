/** How the layer readers tell a value from noise. */
export const LAYER_READ = {
  /** A layer draws past its box when its render bounds reach over half a pixel past it: less is rounding (0.7.0). */
  drawnPastPx: 0.5,
} as const;

/** Figma's defaults the appearance reader leaves out. */
export const APPEARANCE_FIELD = {
  opaque: 1,
  /** A frame passes through, a shape is normal: both blend as nothing. */
  plainBlends: ["PASS_THROUGH", "NORMAL"],
  /** The constraint pinned to the start, Figma's default on both axes. */
  start: "MIN",
} as const;

/** The run fields every Figma has; their values go on the wire as they are (getStyledTextSegments). */
const BASE_SEGMENT_FIELDS = [
  "fontName",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textDecoration",
  "textCase",
  "lineHeight",
  "letterSpacing",
  "fills",
  "fillStyleId",
  "textStyleId",
  "hyperlink",
  "boundVariables",
] as const;

/** The text reader's fields and the defaults it leaves out. */
export const TEXT_FIELD = {
  text: "TEXT",
  textPath: "TEXT_PATH",
  /** A text on a path never sizes itself to its text: its path holds it. */
  pathResize: "NONE",
  noTruncation: "DISABLED",
  noTrim: "NONE",
  baseSegmentFields: BASE_SEGMENT_FIELDS,
  /**
   * FX-012: newer run fields (text wrap, Aug 2026); a Figma without one refuses the whole call, so the reader asks for
   * them first and falls back to the base fields.
   */
  segmentFields: [
    ...BASE_SEGMENT_FIELDS,
    "textDecorationStyle",
    "textDecorationOffset",
    "textDecorationThickness",
    "textDecorationColor",
    "listOptions",
    "indentation",
    "paragraphIndent",
    "paragraphSpacing",
    "textWrapStyle",
    "openTypeFeatures",
  ],
} as const;

/** Figma's stroke cap the stroke reader leaves out: a line's plain end. */
export const STROKE_FIELD = { noCap: "NONE" } as const;

/** Figma's layout values the layout reader tells apart: no layout, a grid, and the defaults it leaves out. */
export const LAYOUT_FIELD = { noLayout: "NONE", grid: "GRID", flowing: "AUTO", inherit: "INHERIT" } as const;
