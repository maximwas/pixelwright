import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { BLEND_CSS } from "@/core/css/groups/appearance/appearance.constants.ts";

/**
 * Layers drawn as SVG, whose fills and strokes are the vector's own, not a box's background and border: shapes, and
 * Figma Draw's transform groups, which CSS cannot draw.
 */
export const VECTOR_TYPES: Readonly<Record<string, true>> = {
  VECTOR: true,
  BOOLEAN_OPERATION: true,
  STAR: true,
  POLYGON: true,
  TRANSFORM_GROUP: true,
};

/** Layers that hold text: a text, and Figma Draw's text on a path; their fill is the text's colour. */
export const TEXT_TYPES: Readonly<Record<string, true>> = { TEXT: true, TEXT_PATH: true };

export const FIGMA_PAINT_GROUP = {
  line: "LINE",
  outside: "OUTSIDE",
  centre: "CENTER",
  inside: "INSIDE",
  normal: "NORMAL",
  /** Line caps a CSS border's square ends cannot draw. */
  caps: ["ROUND", "SQUARE"],
} as const;

/** Per-side weights as Figma keeps them, and the CSS side each is. */
export const SIDE_WEIGHTS = [
  ["strokeTopWeight", CSS_PROPERTY.borderTop],
  ["strokeRightWeight", CSS_PROPERTY.borderRight],
  ["strokeBottomWeight", CSS_PROPERTY.borderBottom],
  ["strokeLeftWeight", CSS_PROPERTY.borderLeft],
] as const;

export const PAINT_NUMBER = {
  /** Figma's stroke weight when a layer does not say. */
  defaultWeight: 1,
  /** CSS centres a text's stroke on the glyph's edge: an outside one is twice as wide, its inner half under the fill. */
  outsideTextStroke: 2,
} as const;

export const PAINT_VALUE = {
  solid: "solid",
  dashed: "dashed",
  currentColor: "currentColor",
  centre: "center",
  inside: "inside",
  normal: "normal",
  strokeFirst: "stroke fill",
} as const;

/** CSS design_apply cannot write back, shown in `$css`. */
export const PAINT_NOTE = {
  strokeAlign: "stroke-align",
  lineCap: "stroke-linecap",
  /** A text's fills blending with each other: CSS's color cannot. */
  fillBlendMode: "fill-blend-mode",
} as const;

/** Figma's linear burn and dodge: plus-darker and plus-lighter, which mix-blend-mode takes, background-blend-mode not. */
const MIX_ONLY_BLENDS: readonly string[] = ["LINEAR_BURN", "LINEAR_DODGE"];

/** Figma's paint blend modes as background-blend-mode's; a mode missing here is a note. */
export const BACKGROUND_BLEND_CSS: Readonly<Record<string, string>> = {
  NORMAL: "normal",
  PASS_THROUGH: "normal",
  ...Object.fromEntries(Object.entries(BLEND_CSS).filter(([mode]) => !MIX_ONLY_BLENDS.includes(mode))),
};

/** D-20: the fixed note for a paint the table cannot write, never Figma's own CSS (getCSSAsync hangs, B-030). */
export const UNMAPPED_NOTE = {
  [CSS_PROPERTY.background]: "a gradient or other fill the table cannot write yet",
  [CSS_PROPERTY.color]: "a gradient or image fill",
  [CSS_PROPERTY.border]: "a gradient or other stroke the table cannot write yet",
} as const;

/** B-001, D-23: a video fill is marked as one: no exported file holds it, so a build must bring its own. */
export const FILL_NOTE = { video: "a video fill (the Plugin API exports no file of it)" } as const;

export const PAINT_TEXT = {
  border: (
    weight: number,
    style: string,
    color: string,
  ) => `${weight}px ${style} ${color}`,
  textStroke: (weight: number, color: string) => `${weight}px ${color}`,
} as const;

export const FILLS_ATTRIBUTES = [CSS_PROPERTY.background, CSS_PROPERTY.backgroundBlendMode, CSS_PROPERTY.color];
export const FILLS_SOURCES = ["fills", "fillStyleId"];

export const STROKES_ATTRIBUTES = [
  CSS_PROPERTY.border,
  CSS_PROPERTY.borderTop,
  CSS_PROPERTY.borderRight,
  CSS_PROPERTY.borderBottom,
  CSS_PROPERTY.borderLeft,
  CSS_PROPERTY.outline,
  CSS_PROPERTY.webkitTextStroke,
  CSS_PROPERTY.paintOrder,
];
export const STROKES_SOURCES = [
  "strokes",
  "strokeStyleId",
  "strokeWeight",
  ...SIDE_WEIGHTS.map(([field]) => field),
  "strokeAlign",
  "strokeCap",
  "dashPattern",
  "rotation",
];

/** What the fills writer writes (C-081): a box's background and a text's colour, each as the fills it sets. */
/** What the fills writer owns: a layer's background (a text's colour is the text writer's, painted with paints()). */
export const FILLS_WRITTEN = [CSS_PROPERTY.background];

/** The CSS sides of a stroke, as Figma's per-side weights name them. */
export const STROKE_SIDES = [
  ["top", CSS_PROPERTY.borderTop],
  ["right", CSS_PROPERTY.borderRight],
  ["bottom", CSS_PROPERTY.borderBottom],
  ["left", CSS_PROPERTY.borderLeft],
] as const;

/** What the strokes writer writes (C-091): border, its sides and outline; a text's stroke is not written yet. */
export const STROKES_WRITTEN = [CSS_PROPERTY.border, ...STROKE_SIDES.map(([, name]) => name), CSS_PROPERTY.outline];

/** A border's style words; dotted is drawn dashed (Figma has one dash). */
export const BORDER_STYLES: Readonly<Record<string, true>> = {
  solid: true,
  dashed: true,
  dotted: true,
  none: true,
  hidden: true,
};

export const PAINT_WRITE = {
  none: "none",
  transparent: "transparent",
  zero: "0",
  hidden: "hidden",
  contain: "contain",
  gradient: "gradient(",
  error: "error",
  /** The first characters of a value an error shows. */
  shownChars: 40,
  /** A flat gradient: one colour twice. */
  flatStops: 2,
} as const;

export const PAINT_PATTERN = { flat: /^linear-gradient\((.+)\)$/s, repeat: /(^|\s)repeat(\s|$)/ } as const;

/** The fills' and strokes' refusals, with 0.7.0's words (C-081, C-091). */
export const PAINT_ERROR = {
  textImage: "A text is coloured with paint, not an image.",
  textGradient: "A text is coloured with a colour or a token, not a gradient.",
  colourHint: "Use a colour or a token.",
  gradient: (layer: string) => `${layer.slice(0, PAINT_WRITE.shownChars)}…: this gradient is not written.`,
  gradientHint: "Write linear-, radial- or conic-gradient() with colours or tokens in their stops (no repeating ones).",
  notPaint: (attribute: string, value: string) =>
    `${attribute}="${value}" is not a colour, a token or color-mix(in srgb, var(--x) N%, transparent) (in display-p3 in a Display P3 file).`,
  both: "Figma strokes a layer once: write border (inside) or outline (outside), not both.",
  sidesDiffer: "Figma draws every side of a stroke in one colour and style: give the sides the same ones.",
  badSide: (attribute: string, value: string) => `${attribute}="${value}" is not "Npx solid|dashed <colour or token>".`,
} as const;
