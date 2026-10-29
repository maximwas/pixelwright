import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

/** Figma's blend modes as CSS's mix-blend-mode (Figma's linear burn and dodge are CSS's plus-darker and plus-lighter). */
export const BLEND_CSS: Readonly<Record<string, string>> = {
  DARKEN: "darken",
  MULTIPLY: "multiply",
  COLOR_BURN: "color-burn",
  LINEAR_BURN: "plus-darker",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  COLOR_DODGE: "color-dodge",
  LINEAR_DODGE: "plus-lighter",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity",
};

/** Layers whose corners are no box's radius: texts, vector shapes and lines. */
export const UNROUNDED: Readonly<Record<string, true>> = {
  TEXT: true,
  TEXT_PATH: true,
  VECTOR: true,
  BOOLEAN_OPERATION: true,
  STAR: true,
  POLYGON: true,
  TRANSFORM_GROUP: true,
  LINE: true,
};

export const FIGMA_APPEARANCE = {
  ellipse: "ELLIPSE",
  /** A text truncated with an ellipsis at its end. */
  truncated: "ENDING",
  squareGrid: "GRID",
  rows: "ROWS",
  stretch: "STRETCH",
  centre: "CENTER",
} as const;

export const APPEARANCE_VALUE = {
  hidden: "hidden",
  ellipsis: "ellipsis",
  nowrap: "nowrap",
  /** An ellipse's own shape (Dev Mode writes px). */
  round: "50%",
  cornerJoint: " ",
  gridJoint: " + ",
  rows: "rows",
  columns: "columns",
  margin: "margin",
  offset: "offset",
  stretch: "stretch",
  center: "center",
} as const;

export const APPEARANCE_NUMBER = {
  /** A truncated text on one line is CSS's ellipsis; more lines are a line clamp. */
  oneLine: 1,
  /** A line grid without a count has one line. */
  oneLineGrid: 1,
} as const;

/** CSS design_apply cannot write back, shown in `$css`. */
export const APPEARANCE_NOTE = { layoutGrid: "layout-grid", lineClamp: "line-clamp" } as const;

export const APPEARANCE_TEXT = {
  blend: (mode: string) => mode.toLowerCase().replaceAll("_", "-"),
  squareGrid: (size: string) => `${size} grid`,
  lineGrid: (
    count: number,
    unit: string,
    alignment: string,
  ) => `${count} ${unit} ${alignment}`,
  wide: (size: string) => ` ${size} wide`,
  gutter: (size: string) => `, gutter ${size}`,
  edge: (name: string, size: string) => `, ${name} ${size}`,
} as const;

/** A box's corners as Figma names them, top left first and clockwise, as CSS's border-radius lists them. */
export const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** The CSS the appearance group owns: how a layer shows as a whole, its clipping and its corners. */
export const APPEARANCE_ATTRIBUTES = [
  CSS_PROPERTY.opacity,
  CSS_PROPERTY.mixBlendMode,
  CSS_PROPERTY.overflow,
  CSS_PROPERTY.textOverflow,
  CSS_PROPERTY.whiteSpace,
  CSS_PROPERTY.borderRadius,
] as const;

/** The read-model fields the appearance group reads. */
export const APPEARANCE_SOURCES = [
  "type",
  "opacity",
  "blendMode",
  "clipsContent",
  "text",
  "cornerRadius",
  ...CORNERS,
  "layoutGrids",
  "css",
] as const;
