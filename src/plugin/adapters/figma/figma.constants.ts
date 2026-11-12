import { DEV_STATUS } from "@/shared/ops/outline/outline.constants.ts";

/** Figma's Dev Mode statuses as the tools write them (T-034, T-044). */
export const FIGMA_DEV_STATUS = { READY_FOR_DEV: DEV_STATUS.ready, COMPLETED: DEV_STATUS.completed } as const;

/**
 * What execute's figma leaves out (D-11, O-028): approved code must not flip the stored Allow edits or the window, nor
 * close the plugin (and its link with the server) or put another window in its place.
 */
export const CODE_FIGMA_HIDDEN = ["clientStorage", "ui", "closePlugin", "showUI"] as const;

/** The node types the plugin tells apart: the document and its pages, and what finds and outlines read of layers. */
export const FIGMA_NODE_TYPE = {
  document: "DOCUMENT",
  page: "PAGE",
  instance: "INSTANCE",
  /** What an instance's slot holds is the instance's own (T-045). */
  slot: "SLOT",
  componentSet: "COMPONENT_SET",
  component: "COMPONENT",
  frame: "FRAME",
  section: "SECTION",
  line: "LINE",
  text: "TEXT",
} as const;

const FRAME_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SLOT"] as const;
const SHAPE_TYPES = ["RECTANGLE", "ELLIPSE", "LINE", "POLYGON", "STAR", "VECTOR"] as const;
/** FigJam's stickers: shapes with a size, fills, strokes and effects of their own. */
const STICKER_TYPES = ["STAMP", "HIGHLIGHT", "WASHI_TAPE"] as const;
const BLENDED_TYPES = [
  ...FRAME_TYPES,
  ...SHAPE_TYPES,
  ...STICKER_TYPES,
  "GROUP",
  "TEXT",
  "BOOLEAN_OPERATION",
  "TEXT_PATH",
  "TRANSFORM_GROUP",
] as const;
const PAINTED_TYPES = [
  ...FRAME_TYPES,
  ...SHAPE_TYPES,
  ...STICKER_TYPES,
  "SECTION",
  "TEXT",
  "BOOLEAN_OPERATION",
  "TEXT_PATH",
  "SLIDE",
] as const;

/**
 * What each node type can take (P-079), as Figma's typings give each type its members: a write step names the one it
 * needs, and a layer of another type is refused on dry and real runs alike.
 */
export const CAPABILITY_TYPES = {
  /** Figma's line takes fills but draws none, so a fill on one is refused. */
  fills: [...PAINTED_TYPES.filter((type) => type !== "LINE"), "STICKY", "SHAPE_WITH_TEXT", "TABLE"],
  strokes: [...PAINTED_TYPES, "SHAPE_WITH_TEXT", "CONNECTOR"],
  effects: [...BLENDED_TYPES, "SLIDE"],
  opacity: [...BLENDED_TYPES, "SLIDE", "STICKY", "SHAPE_WITH_TEXT", "CONNECTOR", "TABLE", "CODE_BLOCK"],
  autoLayout: FRAME_TYPES,
  clipping: FRAME_TYPES,
  corners: [
    ...FRAME_TYPES,
    "SECTION",
    "SLIDE",
    "RECTANGLE",
    "ELLIPSE",
    "POLYGON",
    "STAR",
    "VECTOR",
    "BOOLEAN_OPERATION",
    "HIGHLIGHT",
  ],
  cornerSides: [...FRAME_TYPES, "SECTION", "SLIDE", "RECTANGLE"],
  strokeSides: [...FRAME_TYPES, "SLIDE", "RECTANGLE"],
  /** A section is sized without constraints; a slice has a size but no look. */
  size: [...BLENDED_TYPES, "SLICE", "SECTION"],
  constraints: [...FRAME_TYPES, ...SHAPE_TYPES, "TEXT", "TEXT_PATH", "STAMP", "HIGHLIGHT"],
  annotations: [...FRAME_TYPES, ...SHAPE_TYPES, "TEXT", "TEXT_PATH"],
  text: ["TEXT", "TEXT_PATH"],
  children: [...FRAME_TYPES, "GROUP", "SECTION", "BOOLEAN_OPERATION", "TRANSFORM_GROUP", "PAGE"],
} as const satisfies Record<string, readonly NodeType[]>;

/** The capabilities by name, as write steps name them. */
export const CAPABILITY = {
  fills: "fills",
  strokes: "strokes",
  effects: "effects",
  opacity: "opacity",
  autoLayout: "autoLayout",
  clipping: "clipping",
  corners: "corners",
  cornerSides: "cornerSides",
  strokeSides: "strokeSides",
  size: "size",
  constraints: "constraints",
  annotations: "annotations",
  text: "text",
  children: "children",
} as const satisfies Record<keyof typeof CAPABILITY_TYPES, keyof typeof CAPABILITY_TYPES>;

export const CAPABILITY_TEXT = {
  what: {
    fills: "fills",
    strokes: "strokes",
    effects: "effects",
    opacity: "opacity",
    autoLayout: "auto layout",
    clipping: "clipping",
    corners: "corner radius",
    cornerSides: "radius per corner",
    strokeSides: "stroke weight per side",
    size: "size of its own",
    constraints: "constraints",
    annotations: "annotations",
    text: "text",
    children: "layers inside",
  } satisfies Record<keyof typeof CAPABILITY_TYPES, string>,
  /** A node type as words: COMPONENT_SET is "component set". */
  type: (type: string) => type.toLowerCase().replaceAll("_", " "),
  refusal: (type: string, what: string) => `A ${type} has no ${what}.`,
} as const;

/** A write that cannot be done, as design_apply names it. */
export const WRITE_ERROR_NAME = "WriteError";

/** The node type and text field pw.fonts reads. */
export const CODE_FONTS = {
  text: "TEXT",
  fontName: "fontName",
  key: (font: FontName) => `${font.family}\u0000${font.style}`,
} as const;

/** The Figma events the adapters listen to. */
export const FIGMA_EVENT = { selectionChange: "selectionchange" } as const;

export const CODE_FIGMA_TEXT = { noLayer: (id: string) => `No layer ${id} in this file.` } as const;
