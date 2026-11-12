import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

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
