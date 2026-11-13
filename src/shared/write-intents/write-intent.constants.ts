/** Words of the write intent: what an element asks of its layer, in Figma's terms (K-064, C-181). */

export const INTENT_LAYOUT_MODE = {
  NONE: "NONE",
  HORIZONTAL: "HORIZONTAL",
  VERTICAL: "VERTICAL",
  GRID: "GRID",
} as const;

export const INTENT_LAYOUT_WRAP = { WRAP: "WRAP", NO_WRAP: "NO_WRAP" } as const;

export const INTENT_PRIMARY_ALIGN = {
  MIN: "MIN",
  CENTER: "CENTER",
  MAX: "MAX",
  SPACE_BETWEEN: "SPACE_BETWEEN",
  SPACE_EVENLY: "SPACE_EVENLY",
  SPACE_AROUND: "SPACE_AROUND",
} as const;

export const INTENT_COUNTER_ALIGN = { MIN: "MIN", CENTER: "CENTER", MAX: "MAX", BASELINE: "BASELINE" } as const;

export const INTENT_ALIGN_CONTENT = { AUTO: "AUTO", SPACE_BETWEEN: "SPACE_BETWEEN" } as const;

export const INTENT_TRACK = { FLEX: "FLEX", FIXED: "FIXED", HUG: "HUG" } as const;

/** align-self and justify-self: in a grid the child's place in its cell, in a flex parent STRETCH fills across. */
export const INTENT_SELF_ALIGN = {
  AUTO: "AUTO",
  MIN: "MIN",
  CENTER: "CENTER",
  MAX: "MAX",
  STRETCH: "STRETCH",
} as const;

export const INTENT_HUG = "HUG";

export const INTENT_AXIS = { MIN: "MIN", MAX: "MAX", CENTER: "CENTER", STRETCH: "STRETCH", SCALE: "SCALE" } as const;

export const INTENT_PAINT = { color: "color", token: "token", gradient: "gradient", image: "image" } as const;

export const INTENT_GRADIENT = { LINEAR: "LINEAR", RADIAL: "RADIAL", ANGULAR: "ANGULAR" } as const;

export const INTENT_UNIT = { px: "px", percent: "%" } as const;

export const INTENT_TEXT_UNIT = { AUTO: "AUTO", PIXELS: "PIXELS", PERCENT: "PERCENT" } as const;

export const INTENT_SCALE_MODE = { FILL: "FILL", FIT: "FIT", TILE: "TILE" } as const;

export const INTENT_STROKE_ALIGN = { INSIDE: "INSIDE", OUTSIDE: "OUTSIDE" } as const;

export const INTENT_EFFECT = {
  DROP_SHADOW: "DROP_SHADOW",
  INNER_SHADOW: "INNER_SHADOW",
  LAYER_BLUR: "LAYER_BLUR",
  BACKGROUND_BLUR: "BACKGROUND_BLUR",
} as const;

export const INTENT_MASK = { ALPHA: "ALPHA", VECTOR: "VECTOR", LUMINANCE: "LUMINANCE" } as const;

export const INTENT_TEXT_CASE = { ORIGINAL: "ORIGINAL", UPPER: "UPPER", LOWER: "LOWER", TITLE: "TITLE" } as const;

export const INTENT_TEXT_ALIGN = { LEFT: "LEFT", CENTER: "CENTER", RIGHT: "RIGHT", JUSTIFIED: "JUSTIFIED" } as const;

export const INTENT_TEXT_WRAP = { AUTO: "AUTO", BALANCE: "BALANCE", PRETTY: "PRETTY" } as const;

export const INTENT_DECORATION = { NONE: "NONE", UNDERLINE: "UNDERLINE", STRIKETHROUGH: "STRIKETHROUGH" } as const;

export const INTENT_DECORATION_STYLE = { SOLID: "SOLID", WAVY: "WAVY", DOTTED: "DOTTED", DASHED: "DASHED" } as const;

export const INTENT_ASSET = { image: "image", icon: "icon" } as const;

/** A colour on the wire: Display P3 channels say so, sRGB ones leave it out. */
export const INTENT_COLOR_SPACE = "display-p3";

/** The keys of FigmaProps a write sets, so a group names them from here and the compiler checks them. */
export const INTENT_KEY = {
  visible: "visible",
  layoutMode: "layoutMode",
  layoutWrap: "layoutWrap",
  itemSpacing: "itemSpacing",
  counterAxisSpacing: "counterAxisSpacing",
  padding: "padding",
  primaryAxisAlignItems: "primaryAxisAlignItems",
  counterAxisAlignItems: "counterAxisAlignItems",
  counterAxisAlignContent: "counterAxisAlignContent",
  gridColumns: "gridColumns",
  gridRows: "gridRows",
  gridColumnGap: "gridColumnGap",
  gridRowGap: "gridRowGap",
  minWidth: "minWidth",
  maxWidth: "maxWidth",
  minHeight: "minHeight",
  maxHeight: "maxHeight",
  grow: "grow",
  alignSelf: "alignSelf",
  justifySelf: "justifySelf",
  gridRow: "gridRow",
  gridColumn: "gridColumn",
  absolute: "absolute",
  opacity: "opacity",
  blendMode: "blendMode",
  clipsContent: "clipsContent",
  truncate: "truncate",
  cornerRadius: "cornerRadius",
  fills: "fills",
  textFills: "textFills",
  strokes: "strokes",
  effects: "effects",
  name: "name",
  hyperlink: "hyperlink",
  component: "component",
  variant: "variant",
  props: "props",
  description: "description",
  notes: "notes",
  property: "property",
  mask: "mask",
  asset: "asset",
  modes: "modes",
  textStyle: "textStyle",
  font: "font",
  letterSpacing: "letterSpacing",
  textCase: "textCase",
  textDecoration: "textDecoration",
  textAlignHorizontal: "textAlignHorizontal",
  textWrapStyle: "textWrapStyle",
  rotation: "rotation",
  mirror: "mirror",
  path: "path",
  pathStart: "pathStart",
  horizontal: "horizontal",
  vertical: "vertical",
} as const;
