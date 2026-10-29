import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

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
} as const;

export const PAINT_VALUE = {
  solid: "solid",
  dashed: "dashed",
  currentColor: "currentColor",
  centre: "center",
} as const;

/** CSS design_apply cannot write back, shown in `$css`. */
export const PAINT_NOTE = { strokeAlign: "stroke-align", lineCap: "stroke-linecap" } as const;

/** D-20: the fixed note for a paint the table cannot write, never Figma's own CSS (getCSSAsync hangs, B-030). */
export const UNMAPPED_NOTE = {
  [CSS_PROPERTY.background]: "a gradient or other fill the table cannot write yet",
  [CSS_PROPERTY.color]: "a gradient or image fill",
  [CSS_PROPERTY.border]: "a gradient or other stroke the table cannot write yet",
} as const;

export const PAINT_TEXT = {
  border: (
    weight: number,
    style: string,
    color: string,
  ) => `${weight}px ${style} ${color}`,
} as const;

export const FILLS_ATTRIBUTES = [CSS_PROPERTY.background, CSS_PROPERTY.color];
export const FILLS_SOURCES = ["fills", "fillStyleId"];

export const STROKES_ATTRIBUTES = [
  CSS_PROPERTY.border,
  CSS_PROPERTY.borderTop,
  CSS_PROPERTY.borderRight,
  CSS_PROPERTY.borderBottom,
  CSS_PROPERTY.borderLeft,
  CSS_PROPERTY.outline,
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
