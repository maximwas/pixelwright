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
  blend: ["blendMode"],
  mask: ["mask"],
  corners: ["cornerRadius"],
  fills: ["fills"],
  strokes: ["strokes"],
  effects: ["effects"],
} as const satisfies Record<string, readonly (keyof FigmaProps)[]>;

/** The paint lists a layer has, and the style field beside each. */
export const PAINT_FIELD = { fills: "fills", strokes: "strokes" } as const;

/** How a layer shows: a CSS normal on a layer whose children blend as one is Figma's pass through. */
export const BLEND = {
  normal: "NORMAL",
  passThrough: "PASS_THROUGH",
  passing: ["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"],
} as const;

export const STROKE = {
  line: "LINE",
  center: "CENTER",
  inside: "INSIDE",
  /** A CSS dashed border has no pattern of its own: 4 on, 4 off, 0.7.0's. */
  dash: [4, 4],
} as const;

/** The corner fields in CSS's order: top left, top right, bottom right, bottom left. */
export const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

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
  paintStyle: (token: string) => `${token} is a paint style, which is the whole list of a layer's paints.`,
  paintStyleHint: "Use it as the only layer, without color-mix().",
  noEffectStyle: (token: string) => `No effect style is named ${token} in this file or the libraries its page uses.`,
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
