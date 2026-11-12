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
