import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

/** Figma's auto layout and grid modes; NONE (no layout) reads nothing. */
export const LAYOUT_MODE = { horizontal: "HORIZONTAL", vertical: "VERTICAL", grid: "GRID" } as const;

export const FIGMA_LAYOUT = {
  wrap: "WRAP",
  /** Figma's default alignment, left out of the CSS. */
  start: "MIN",
  spaceBetween: "SPACE_BETWEEN",
  fixedTrack: "FIXED",
  hugTrack: "HUG",
} as const;

/** Figma's main-axis alignment as justify-content; the start is the default and left out. */
export const JUSTIFY_CSS: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
  SPACE_EVENLY: "space-evenly",
  SPACE_AROUND: "space-around",
};

/** Figma's cross-axis alignment as align-items; the start is the default and left out. */
export const ALIGN_CSS: Readonly<Record<string, string>> = { CENTER: "center", MAX: "flex-end", BASELINE: "baseline" };

/** Ways of spreading children that space them themselves: no room for a gap (C-031). */
export const SPREAD: Readonly<Record<string, true>> = { SPACE_BETWEEN: true, SPACE_EVENLY: true, SPACE_AROUND: true };

export const LAYOUT_VALUE = {
  flex: "flex",
  grid: "grid",
  column: "column",
  wrap: "wrap",
  spaceBetween: "space-between",
  hugTrack: "auto",
  trackJoint: " ",
} as const;

export const LAYOUT_NUMBER = {
  /** A gap spaces two children at least: with fewer it spaces nothing (C-031). */
  spacedChildren: 2,
  /** A flex track without a value takes one share. */
  oneShare: 1,
  /** Equal tracks read as repeat() from three on; two read as they are, as 0.7.0 wrote them. */
  repeatFrom: 3,
} as const;

export const LAYOUT_TEXT = {
  overlap: (gap: string) => `${gap} (the children overlap)`,
  repeat: (count: number, size: string) => `repeat(${count}, ${size})`,
  share: (share: number) => `${share}fr`,
} as const;

/** The CSS the layout group owns: a frame's own layout, auto layout or grid. */
export const LAYOUT_ATTRIBUTES = [
  CSS_PROPERTY.display,
  CSS_PROPERTY.flexDirection,
  CSS_PROPERTY.flexWrap,
  CSS_PROPERTY.padding,
  CSS_PROPERTY.paddingTop,
  CSS_PROPERTY.paddingRight,
  CSS_PROPERTY.paddingBottom,
  CSS_PROPERTY.paddingLeft,
  CSS_PROPERTY.justifyContent,
  CSS_PROPERTY.alignItems,
  CSS_PROPERTY.alignContent,
  CSS_PROPERTY.gap,
  CSS_PROPERTY.columnGap,
  CSS_PROPERTY.rowGap,
  CSS_PROPERTY.gridTemplateColumns,
  CSS_PROPERTY.gridTemplateRows,
] as const;

/** The read-model fields the layout group reads. */
export const LAYOUT_SOURCES = [
  "layoutMode",
  "layoutWrap",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "counterAxisAlignContent",
  "itemSpacing",
  "counterAxisSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gridRowCount",
  "gridColumnCount",
  "gridRowGap",
  "gridColumnGap",
  "gridRowSizes",
  "gridColumnSizes",
] as const;

/** The fields the layout group writes as lengths, each a bound variable's var() when one is bound (T-163). */
export const LAYOUT_FIELD = {
  itemSpacing: "itemSpacing",
  counterAxisSpacing: "counterAxisSpacing",
  gridColumnGap: "gridColumnGap",
  gridRowGap: "gridRowGap",
} as const;

export const PADDING_FIELDS = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;
