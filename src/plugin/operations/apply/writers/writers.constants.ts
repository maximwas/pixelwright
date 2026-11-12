import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** The props each write step takes, in the order it sets them. */
export const STEP_KEYS = {
  name: ["name"],
  layout: [
    "layoutMode",
    "layoutWrap",
    "itemSpacing",
    "counterAxisSpacing",
    "padding",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "counterAxisAlignContent",
    "gridColumns",
    "gridRows",
    "gridColumnGap",
    "gridRowGap",
  ],
  size: ["absolute", "width", "height"],
  limits: ["minWidth", "maxWidth", "minHeight", "maxHeight"],
  child: ["grow", "alignSelf", "justifySelf"],
  gridCell: ["gridRow", "gridColumn"],
  turn: ["rotation", "mirror"],
  place: ["horizontal", "vertical"],
  opacity: ["opacity"],
  clip: ["clipsContent"],
  fills: ["fills"],
} as const satisfies Record<string, readonly (keyof FigmaProps)[]>;

/** Figma's paint type of a colour. */
export const FIGMA_PAINT = { solid: "SOLID" } as const;

/** Figma's values for how a layer sizes and places itself. */
export const LAYOUT_SIZING = { fixed: "FIXED", fill: "FILL", hug: "HUG" } as const;
export const TEXT_AUTO_RESIZE = { none: "NONE", height: "HEIGHT", both: "WIDTH_AND_HEIGHT" } as const;
export const LAYOUT_POSITIONING = { absolute: "ABSOLUTE", auto: "AUTO" } as const;

/** A layer's two sizes, by the prop each is. */
export const SIZE_AXIS = { width: "width", height: "height" } as const;

/** The size fields on each axis: a layer's own, its parent's sizing of it, and its grid alignment. */
export const AXIS_FIELDS = {
  width: { sizing: "layoutSizingHorizontal", grid: "gridChildHorizontalAlign", placement: "horizontal" },
  height: { sizing: "layoutSizingVertical", grid: "gridChildVerticalAlign", placement: "vertical" },
} as const;

export const SIZE_NUMBER = {
  /** A new text set to fill is resized to this width first: Figma leaves a 0-wide text 0 wide (B-047). */
  fillingTextWidth: 100,
  /** A text under one pixel wide is the new 0-wide one. */
  zeroWidth: 1,
  /** A line written by its height stands upright: a quarter turn clockwise. */
  standingTurn: -90,
} as const;

/** Hiding runs last, outside the steps (P-149). */
export const HIDDEN_KEY = "visible" satisfies keyof FigmaProps;

export const WRITERS_TEXT = {
  token: (token: string) => `The token ${token} is not bound to Figma in this release: write its value.`,
  paint: (kind: string) => `A ${kind} background is not written to Figma in this release: write a colour.`,
  colourSpace: "A display-p3 colour is not written to Figma in this release: write it in sRGB.",
  sectionHug: "A section is sized in pixels: it cannot hug what it holds.",
  growInGrid: "flex fills a flex parent's direction: this layer's parent is a grid.",
  growInGridHint: 'Fill its cell with justify-self="stretch" and align-self="stretch".',
  growOutside: "flex fills the direction of an auto layout parent: this layer's parent has no auto layout.",
  growOutsideHint: 'Give the parent display="flex", or size the layer with width or height.',
  alignInFlex: "Auto layout aligns its children together: align-self takes stretch or auto here.",
  alignInFlexHint: "Set align-items on the parent.",
  alignOutside: "align-self places a child of auto layout or a grid: this layer's parent has neither.",
  justifyOutside: "justify-self places a grid's child in its cell: this layer's parent is no grid.",
  cellOutside: "grid-row and grid-column place a grid's child: this layer's parent is no grid.",
  flows: (axis: string) =>
    `${axis === "horizontal" ? "left and right" : "top and bottom"} place a layer with position="absolute": this one flows in its auto layout parent.`,
  onPage: "A layer on the page is placed by left and top alone.",
} as const;
