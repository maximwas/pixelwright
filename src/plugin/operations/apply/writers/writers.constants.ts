import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** The props each write step takes, in the order it sets them. */
export const STEP_KEYS = {
  name: ["name"],
  variant: ["component", "variant"],
  props: ["props"],
  property: ["property"],
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
  asset: ["asset"],
  modes: ["modes"],
  notes: ["notes"],
  description: ["description"],
  /** What the text writer takes, after the steps: a text's runs, its box's text settings, a new TextPath's path. */
  text: [
    "textStyle",
    "font",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "textFills",
    "hyperlink",
    "textAlignHorizontal",
    "textWrapStyle",
    "truncate",
    "pathStart",
    "path",
  ],
} as const satisfies Record<string, readonly (keyof FigmaProps)[]>;

/**
 * What a run of text sets, in the order Figma needs it (a style first: it resets what it covers), with the segment
 * fields that tell the runs having the text's own value (P-152).
 */
export const TEXT_RUN_FIELDS = [
  ["textStyle", ["textStyleId"]],
  ["font", ["fontName", "fontSize", "lineHeight"]],
  ["letterSpacing", ["letterSpacing"]],
  ["textCase", ["textCase"]],
  ["textDecoration", ["textDecoration"]],
  ["textFills", ["fills", "fillStyleId"]],
  ["hyperlink", ["hyperlink"]],
] as const satisfies readonly (readonly [keyof FigmaProps, readonly (keyof StyledTextSegment)[]])[];

/** The box's text settings, written over the whole layer. */
export const TEXT_BOX_KEYS = ["textAlignHorizontal", "textWrapStyle", "truncate", "pathStart"] as const;

/** A run's look kept across new characters: Figma gives new characters the first one's (P-152). */
export const TEXT_BASE_FIELDS = [
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
  "fills",
  "fillStyleId",
  "textStyleId",
  "hyperlink",
  "boundVariables",
] as const satisfies readonly (keyof StyledTextSegment)[];

/** The look a text style sets: a restored run takes these from its style, not as values over it. */
export const TEXT_STYLED_FIELDS = [
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
] as const;

/** What a text on a path lacks of a text's look: no lines, no decoration. */
export const TEXT_LINED_FIELDS = ["lineHeight", "textDecoration"] as const;

/**
 * Each text field over a range: the layer's own property (or its async setter) for an empty range, since Figma refuses
 * a range of no characters (P-078), else its setRange method.
 */
export const TEXT_RANGE_FIELD = {
  fontName: { property: "fontName", range: "setRangeFontName" },
  fontSize: { property: "fontSize", range: "setRangeFontSize" },
  lineHeight: { property: "lineHeight", range: "setRangeLineHeight" },
  letterSpacing: { property: "letterSpacing", range: "setRangeLetterSpacing" },
  textCase: { property: "textCase", range: "setRangeTextCase" },
  textDecoration: { property: "textDecoration", range: "setRangeTextDecoration" },
  textDecorationStyle: { property: "textDecorationStyle", range: "setRangeTextDecorationStyle" },
  textDecorationColor: { property: "textDecorationColor", range: "setRangeTextDecorationColor" },
  textDecorationOffset: { property: "textDecorationOffset", range: "setRangeTextDecorationOffset" },
  textDecorationThickness: { property: "textDecorationThickness", range: "setRangeTextDecorationThickness" },
  fills: { property: "fills", range: "setRangeFills" },
  hyperlink: { property: "hyperlink", range: "setRangeHyperlink" },
  textStyleId: { whole: "setTextStyleIdAsync", range: "setRangeTextStyleIdAsync" },
  fillStyleId: { whole: "setFillStyleIdAsync", range: "setRangeFillStyleIdAsync" },
} as const;

/** What only one kind of text layer has, and what its refusal calls it: a text on a path has fewer of a text's. */
export const TEXT_OWN = {
  textDecoration: ["TEXT", "underline or strike-through"],
  textWrapStyle: ["TEXT", "text wrapping"],
  truncate: ["TEXT", "truncation"],
  pathStart: ["TEXT_PATH", "path for its text to start on"],
} as const satisfies Partial<Record<keyof FigmaProps, readonly [NodeType, string]>>;

/** Figma's text values the text writer sets. */
export const TEXT_FIGMA = {
  auto: "AUTO",
  solid: "SOLID",
  url: "URL",
  ending: "ENDING",
  disabled: "DISABLED",
  /** Truncation shows one line, then an ellipsis. */
  truncatedLines: 1,
} as const;

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

/** design_read's note: `Category: text`, the category ending at the first `: ` (T-139). */
export const NOTE_VALUE = { category: ": " } as const;

/** Hiding runs last, outside the steps (P-149). */
export const HIDDEN_KEY = "visible" satisfies keyof FigmaProps;

/** How an instance's props are written: a boolean property's "true", and the names an error lists. */
export const PROPS_VALUE = { trueValue: "true", falseValue: "false", listJoint: ", " } as const;

export const WRITERS_TEXT = {
  componentOnComponent: "A component has no component: component and variant make an <Instance>.",
  componentGone: (id: string) => `${id}'s component is gone: Figma cannot change its variant or props.`,
  noProperty: (
    instance: string,
    name: string,
    has: string,
  ) => `${instance} has no property ${name}: it has ${has}.`,
  nearProperty: (near: string) => `Did you mean ${near}?`,
  notBoolean: (name: string, value: string) => `${name} is a true or false property: ${value} is neither.`,
  paintStyle: (token: string) => `${token} is a paint style, which is the whole list of a layer's paints.`,
  paintStyleHint: "Use it as the only layer, without color-mix().",
  noEffectStyle: (token: string) => `No effect style is named ${token} in this file or the libraries its page uses.`,
  sectionHug: "A section is sized in pixels: it cannot hug what it holds.",
  sectionToken: "A section's size takes a number of pixels, not a token.",
  description: "A description belongs to a component or a component set.",
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
  note: (category: string, label: string) => `${category}: ${label}`,
  /** A bar between new words is the agent's text: one note (B-017). */
  barred: (text: string, part: string) => `${text} | ${part}`,
  noModes: (type: string) => `A ${type} takes no variable modes.`,
  noCollection: (slug: string) => `data-${slug} names no variable collection this file reaches.`,
  modesHint: "tokens_read lists the file's collections and their modes.",
  listedCollection: (name: string, slug: string) => `${name} (data-${slug})`,
  collections: (listed: readonly string[]) => `It has ${listed.join(", ")}.`,
  noCollections: "The file has no variable collections.",
  noTextStyle: (token: string) => `No text style is named ${token} in this file or the libraries its page uses.`,
  textStyleHint: "tokens_read lists the file's text styles.",
  unloaded: (family: string, style: string) =>
    `The text uses ${family} ${style}, which this Figma cannot load: its characters cannot change.`,
  unloadedHint: "Install the font, or give the text a font this Figma has first.",
  noMode: (
    collection: string,
    mode: string,
    modes: readonly string[],
  ) =>
    `${collection} has no mode ${mode}: it has ${modes.join(", ")}.`,
} as const;
