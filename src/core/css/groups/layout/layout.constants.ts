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
  block: "block",
  none: "none",
  row: "row",
  nowrap: "nowrap",
  normal: "normal",
  zero: "0",
  listJoint: ", ",
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

/** The display words Figma has a layout for; the inline ones lay children out as the block ones do (C-040). */
export const DISPLAY_MODE: Readonly<Record<string, string>> = {
  flex: LAYOUT_VALUE.flex,
  "inline-flex": LAYOUT_VALUE.flex,
  grid: LAYOUT_VALUE.grid,
  "inline-grid": LAYOUT_VALUE.grid,
  block: LAYOUT_VALUE.block,
  "inline-block": LAYOUT_VALUE.block,
  none: LAYOUT_VALUE.none,
};

/** What a frame's attributes are named when a rule reads them together. */
export const LAYOUT_RULE_ATTRIBUTES = [
  CSS_PROPERTY.display,
  CSS_PROPERTY.flexDirection,
  CSS_PROPERTY.flexWrap,
  CSS_PROPERTY.gap,
  CSS_PROPERTY.rowGap,
  CSS_PROPERTY.columnGap,
  CSS_PROPERTY.gridTemplateColumns,
  CSS_PROPERTY.gridTemplateRows,
] as const;

/** A padding's sides on their own, in the shorthand's order. */
export const PADDING_SIDES = [
  CSS_PROPERTY.paddingTop,
  CSS_PROPERTY.paddingRight,
  CSS_PROPERTY.paddingBottom,
  CSS_PROPERTY.paddingLeft,
] as const;

export const FIGMA_FLEX = {
  vertical: "VERTICAL",
  horizontal: "HORIZONTAL",
  grid: "GRID",
  none: "NONE",
  wrap: "WRAP",
  noWrap: "NO_WRAP",
  start: "MIN",
  auto: "AUTO",
  hug: "HUG",
  flexTrack: "FLEX",
  fixedTrack: "FIXED",
} as const;

export const JUSTIFY_FIGMA = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  "space-between": "SPACE_BETWEEN",
  "space-evenly": "SPACE_EVENLY",
  "space-around": "SPACE_AROUND",
} as const;

export const ALIGN_FIGMA = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  baseline: "BASELINE",
} as const;

export const ALIGN_CONTENT_FIGMA = {
  normal: "AUTO",
  "flex-start": "AUTO",
  start: "AUTO",
  "space-between": "SPACE_BETWEEN",
} as const;

/** The track list's pieces: repeat(N, track) written out, a flexible track in fr. */
export const TRACK_PATTERN = { repeat: /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/, fraction: /^(\d*\.?\d+)fr$/ } as const;

/** The refusals and hints of the layout write half, in plain words. */
export const LAYOUT_ERROR = {
  badDisplay: (display: string) =>
    `display="${display}" is not one Figma has: flex, grid, block (no auto layout) or none (hidden).`,
  needsLayout: (name: string) =>
    `${name} needs display="flex" or display="grid": without auto layout it spaces nothing.`,
  badDirection: (direction: string) =>
    `flex-direction="${direction}" is not one Figma has: row or column (auto layout has no reverse order).`,
  badWrap: (wrap: string) => `flex-wrap="${wrap}" is not one Figma has: wrap or nowrap.`,
  needsGrid: (name: string) => `${name} needs display="grid".`,
  needsFlex: (name: string) => `${name} needs display="flex": a grid places its children in tracks.`,
  badBox: (value: string) => `padding="${value}" is not 1 to 4 lengths in px.`,
  badSide: (name: string, value: string) => `${name}="${value}" is not a length in px.`,
  badTracks: (name: string, value: string) => `${name}="${value}" is not tracks in fr, px or auto (repeat() allowed).`,
  badGapShorthand: (gap: string) => `gap="${gap}" is not one or two lengths in px (rows, then columns).`,
  badKeyword: (
    name: string,
    value: string,
    allowed: string,
  ) => `${name}="${value}" is not one Figma has: ${allowed}.`,
  flexOnly: (name: string) => `${name} aligns the children of a flex layout: a grid aligns each child in its cell.`,
  flexOnlyHint: 'Give its children justify-self and align-self ("stretch" fills the cell).',
} as const;
