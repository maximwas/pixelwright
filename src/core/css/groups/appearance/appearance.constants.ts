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

/** CSS's mix-blend-mode as Figma's blend mode (normal is NORMAL; the plugin makes a frame's PASS_THROUGH). */
export const BLEND_FIGMA: Readonly<Record<string, string>> = Object.fromEntries([
  ["normal", "NORMAL"],
  ...Object.entries(BLEND_CSS).map(([figma, css]) => [css, figma]),
]);

/** The words design_apply reads in appearance. */
export const APPEARANCE_WRITE = {
  clip: "clip",
  visible: "visible",
  /** A corner radius with `/` is elliptical: Figma's corners are round. */
  elliptical: "/",
  /** Opacity in percents over 100 is the 0..1 Figma keeps. */
  percent: 100,
  maxCorners: 4,
} as const;

export const APPEARANCE_PATTERN = {
  /** A percent: "50%". */
  percent: /^(-?\d*\.?\d+)%$/,
} as const;

export const APPEARANCE_ERROR = {
  badOpacity: (value: string) => `opacity="${value}" is not a number from 0 to 1 or a percent.`,
  badBlend: (value: string) => `mix-blend-mode="${value}" is no blend mode Figma has.`,
  blendHint: `Figma has normal, ${Object.values(BLEND_CSS).join(", ")}.`,
  truncatesText: (name: string, tag: string) =>
    `${name} truncates a Text; a ${tag} clips its content with overflow="hidden".`,
  badOverflow: (value: string) =>
    `overflow="${value}": Figma clips a frame's content or not, hidden or visible (scrolling is a prototype setting).`,
  badRadius: (value: string) => `border-radius="${value}" is not 1 to 4 lengths in px or tokens.`,
} as const;

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
  /** Figma's corner smoothing is 0 to 1; its panel shows percent. */
  percent: 100,
} as const;

/** CSS design_apply cannot write back, shown in `$css`. */
export const APPEARANCE_NOTE = {
  layoutGrid: "layout-grid",
  lineClamp: "line-clamp",
  /**
   * Figma's corner smoothing: its curve runs on past the radius into the edges. CSS's corner-shape: superellipse()
   * keeps it inside the radius, so no value matches (squircle cuts the corner less, not longer): border-radius stays.
   */
  cornerSmoothing: "corner-smoothing",
} as const;

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
  percent: (value: number) => `${value}%`,
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
  "cornerSmoothing",
  "layoutGrids",
  "css",
] as const;
