import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { INTENT_SELF_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";

/** Figma's constraints on one axis: the start (its default), the end, the centre, both edges, scaled with the parent. */
export const FIGMA_CONSTRAINT = {
  start: "MIN",
  end: "MAX",
  centre: "CENTER",
  stretch: "STRETCH",
  scale: "SCALE",
} as const;

export const FIGMA_GEOMETRY = {
  absolute: "ABSOLUTE",
  /** A group is no frame: its layers keep their place in it whatever their constraints say. */
  group: "GROUP",
  fixed: "FIXED",
  fill: "FILL",
  line: "LINE",
} as const;

/**
 * Each axis: its edges and size in CSS, its sizing and constraint in Figma, the flex direction it is the main axis of;
 * in a grid, its line and its self-alignment in CSS, its anchor, span and alignment in Figma.
 */
export const GEOMETRY_AXIS = {
  horizontal: {
    start: CSS_PROPERTY.left,
    end: CSS_PROPERTY.right,
    size: CSS_PROPERTY.width,
    sizing: "layoutSizingHorizontal",
    constraint: "horizontal",
    direction: "HORIZONTAL",
    line: CSS_PROPERTY.gridColumn,
    anchor: "gridColumnAnchorIndex",
    span: "gridColumnSpan",
    self: "gridChildHorizontalAlign",
    align: CSS_PROPERTY.justifySelf,
    cell: "gridColumn",
    selfKey: "justifySelf",
  },
  vertical: {
    start: CSS_PROPERTY.top,
    end: CSS_PROPERTY.bottom,
    size: CSS_PROPERTY.height,
    sizing: "layoutSizingVertical",
    constraint: "vertical",
    direction: "VERTICAL",
    line: CSS_PROPERTY.gridRow,
    anchor: "gridRowAnchorIndex",
    span: "gridRowSpan",
    self: "gridChildVerticalAlign",
    align: CSS_PROPERTY.alignSelf,
    cell: "gridRow",
    selfKey: "alignSelf",
  },
} as const;

/** The limits a layer's size may have: the CSS property and the read-model field, which share a name. */
export const SIZE_LIMITS = [
  [CSS_PROPERTY.minWidth, "minWidth"],
  [CSS_PROPERTY.maxWidth, "maxWidth"],
  [CSS_PROPERTY.minHeight, "minHeight"],
  [CSS_PROPERTY.maxHeight, "maxHeight"],
] as const;

export const GEOMETRY_VALUE = {
  absolute: "absolute",
  grow: "1",
  stretch: "stretch",
  centre: "50%",
  mirror: "scaleX(-1)",
  minus: "-",
  plus: "+",
  partJoint: " ",
} as const;

/** A grid child's own alignment in its cell as CSS (C-058); AUTO, the cell's own, writes nothing. */
export const GRID_SELF: Readonly<Record<string, string>> = { MIN: "start", CENTER: "center", MAX: "end" };

export const GEOMETRY_NUMBER = {
  /** A scaled layer's start and size are percents of its parent. */
  percent: 100,
  /** CSS counts grid lines from 1, Figma's anchors from 0. */
  firstLine: 1,
  /** A child in one track is its line alone; past it, `N / span M`. */
  oneTrack: 1,
} as const;

export const GEOMETRY_TEXT = {
  fromCentre: (sign: string, pixels: string) => `calc(50% ${sign} ${pixels})`,
  percent: (value: number) => `${value}%`,
  rotate: (degrees: number) => `rotate(${degrees}deg)`,
  line: (line: number) => `${line}`,
  span: (line: number, span: number) => `${line} / span ${span}`,
} as const;

/** align-self and justify-self as Figma takes them, in a grid cell or across a flex parent (C-058). */
export const SELF_FIGMA: Readonly<Record<string, (typeof INTENT_SELF_ALIGN)[keyof typeof INTENT_SELF_ALIGN]>> = {
  auto: INTENT_SELF_ALIGN.AUTO,
  normal: INTENT_SELF_ALIGN.AUTO,
  start: INTENT_SELF_ALIGN.MIN,
  "flex-start": INTENT_SELF_ALIGN.MIN,
  "self-start": INTENT_SELF_ALIGN.MIN,
  center: INTENT_SELF_ALIGN.CENTER,
  end: INTENT_SELF_ALIGN.MAX,
  "flex-end": INTENT_SELF_ALIGN.MAX,
  "self-end": INTENT_SELF_ALIGN.MAX,
  stretch: INTENT_SELF_ALIGN.STRETCH,
};

/** The words design_apply reads in geometry. */
export const GEOMETRY_WRITE = {
  relative: "relative",
  static: "static",
  auto: "auto",
  none: "none",
  initial: "initial",
  /** Sizes that fit the content: Figma's HUG. */
  hugs: ["auto", "fit-content", "max-content"],
  listJoint: ", ",
  /** The key of a placement found, as opposed to one refused. */
  placement: "placement",
} as const;

export const GEOMETRY_PATTERN = {
  /** A percent: "50%", "12.5%". */
  percent: /^(-?\d*\.?\d+)%$/,
  /** An offset from the parent's centre, the one calc() form design_read writes. */
  fromCentre: /^calc\(\s*50%\s*([+-])\s*(\d*\.?\d+)px\s*\)$/,
  /** Grid lines: "N", "N / span M" or "N / M". */
  lines: /^(\d+)(?:\s*\/\s*(?:span\s+(\d+)|(\d+)))?$/,
} as const;

export const GEOMETRY_ERROR = {
  badPosition: (value: string) =>
    `position="${value}" is not one Figma has: absolute, or relative to flow in the parent.`,
  flows: (name: string) => `${name} places a layer with position="absolute"; this one flows in its parent.`,
  flowsHint: (name: string) => `Add position="absolute", or leave ${name} out.`,
  percentStart: (start: string) =>
    `${start} in percents scales the layer with its parent: give its size in percents too.`,
  badStart: (start: string, value: string) =>
    `${start}="${value}" is not a length in px, a percent, calc(50% ± Npx) or auto.`,
  badEnd: (end: string, value: string) => `${end}="${value}" is not a length in px or auto.`,
  badSize: (size: string, value: string) => `${size}="${value}" is not a length in px or auto.`,
  percentSize: (start: string) => `A percent scales with the parent: it needs ${start} in percents too.`,
  badLimit: (limit: string, value: string) => `${limit}="${value}" is not a length in px or none.`,
  growWeight: (value: string) =>
    `flex="${value}": a layer fills its parent's direction or not, flex="1" or flex="none" (Figma has no grow weights).`,
  badLines: (attribute: string, value: string) =>
    `${attribute}="${value}" is not "N", "N / span M" or "N / M", lines counted from 1.`,
  badSelf: (
    attribute: string,
    value: string,
    words: string,
  ) =>
    `${attribute}="${value}" is not one Figma has: ${words}.`,
  badTransform: (part: string) => `transform part ${part} is not rotate(Ndeg) or scaleX(-1), which is all Figma keeps.`,
} as const;

/** 0.7.0's order of a cell's writes: the row axis first (align-self, then justify-self; grid-row, then grid-column). */
export const CELL_AXES = [GEOMETRY_AXIS.vertical, GEOMETRY_AXIS.horizontal] as const;

/** What the transform writer owns. */
export const TRANSFORM_ATTRIBUTES = [CSS_PROPERTY.transform] as const;

export const TRANSFORM_WRITE = {
  none: "none",
  mirror: "scaleX(-1)",
  /** rotate(<angle>), the one turn design_read writes. */
  rotate: /^rotate\((.*)\)$/i,
} as const;

/** What the placement writer owns: position, and each axis's edges and size. */
export const PLACEMENT_ATTRIBUTES = [
  CSS_PROPERTY.position,
  CSS_PROPERTY.left,
  CSS_PROPERTY.right,
  CSS_PROPERTY.top,
  CSS_PROPERTY.bottom,
  CSS_PROPERTY.width,
  CSS_PROPERTY.height,
] as const;

/** What the size writer owns: the limits and filling the flex parent's direction. */
export const SIZE_ATTRIBUTES = [
  CSS_PROPERTY.minWidth,
  CSS_PROPERTY.maxWidth,
  CSS_PROPERTY.minHeight,
  CSS_PROPERTY.maxHeight,
  CSS_PROPERTY.flex,
] as const;

/** What the cell writer owns: the child's own alignment and its grid lines. */
export const CELL_ATTRIBUTES = [
  CSS_PROPERTY.alignSelf,
  CSS_PROPERTY.justifySelf,
  CSS_PROPERTY.gridRow,
  CSS_PROPERTY.gridColumn,
] as const;

/** The CSS the geometry group owns: where a layer is, how big, and how it is turned. */
export const GEOMETRY_ATTRIBUTES = [
  CSS_PROPERTY.position,
  CSS_PROPERTY.left,
  CSS_PROPERTY.right,
  CSS_PROPERTY.top,
  CSS_PROPERTY.bottom,
  CSS_PROPERTY.width,
  CSS_PROPERTY.height,
  CSS_PROPERTY.minWidth,
  CSS_PROPERTY.maxWidth,
  CSS_PROPERTY.minHeight,
  CSS_PROPERTY.maxHeight,
  CSS_PROPERTY.flex,
  CSS_PROPERTY.alignSelf,
  CSS_PROPERTY.gridRow,
  CSS_PROPERTY.gridColumn,
  CSS_PROPERTY.justifySelf,
  CSS_PROPERTY.transform,
] as const;

/** The read-model fields the geometry group reads. */
export const GEOMETRY_SOURCES = [
  "x",
  "y",
  "width",
  "height",
  "bounds",
  "rotation",
  "mirrorTransform",
  "constraints",
  "layoutPositioning",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "gridRowAnchorIndex",
  "gridColumnAnchorIndex",
  "gridRowSpan",
  "gridColumnSpan",
  "gridChildHorizontalAlign",
  "gridChildVerticalAlign",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
] as const;
