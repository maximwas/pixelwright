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
} as const;

/** Each axis: its edges and size in CSS, its sizing and constraint in Figma, the flex direction it is the main axis of. */
export const GEOMETRY_AXIS = {
  horizontal: {
    start: CSS_PROPERTY.left,
    end: CSS_PROPERTY.right,
    size: CSS_PROPERTY.width,
    sizing: "layoutSizingHorizontal",
    constraint: "horizontal",
    direction: "HORIZONTAL",
  },
  vertical: {
    start: CSS_PROPERTY.top,
    end: CSS_PROPERTY.bottom,
    size: CSS_PROPERTY.height,
    sizing: "layoutSizingVertical",
    constraint: "vertical",
    direction: "VERTICAL",
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

export const GEOMETRY_NUMBER = {
  /** A scaled layer's start and size are percents of its parent. */
  percent: 100,
} as const;

export const GEOMETRY_TEXT = {
  fromCentre: (sign: string, pixels: string) => `calc(50% ${sign} ${pixels})`,
  percent: (value: number) => `${value}%`,
  rotate: (degrees: number) => `rotate(${degrees}deg)`,
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
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
] as const;
