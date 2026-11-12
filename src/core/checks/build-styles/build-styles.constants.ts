import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

/**
 * How a design value is held against a computed one: a size or a place (layout rounds it), another length, a colour,
 * a keyword, a font family, a number, a shadow list, background images, a transform, grid tracks; or one this check
 * cannot read, said and not compared.
 */
export const LONGHAND_KIND = {
  box: "box",
  length: "length",
  color: "color",
  keyword: "keyword",
  family: "family",
  number: "number",
  shadows: "shadows",
  images: "images",
  transform: "transform",
  tracks: "tracks",
  unread: "unread",
} as const;

export const BUILD_STYLES_NUMBER = {
  /** How far a length other than a size or a place may be off: a computed style holds it as written, in px. */
  lengthPrecision: 0.05,
  /** An 8-bit step and a half for each channel: hex and rgb() hold 8 bits, and either side may round. */
  colorPrecision: 1.5 / 255,
  /** An opacity, a weight or a grow as CSS computes it. */
  numberPrecision: 0.01,
  /** A computed matrix holds 6 decimals. */
  matrixPrecision: 0.001,
  /** How far a gradient's angle (in degrees) or centre may be off: design_read writes Figma's to hundredths. */
  geometryPrecision: 0.5,
  /** How far a stop may be off, as a part of the gradient's length. */
  stopPrecision: 0.005,
  /** color-mix()'s percent of the colour. */
  percent: 100,
  /** font-weight's words as numbers. */
  normalWeight: 400,
  boldWeight: 700,
  /** A box shorthand's most values: top, right, bottom, left. */
  sides: 4,
  /** A shadow's lengths: x and y, then blur and spread when given. */
  shadowLengths: 2,
  shadowAllLengths: 4,
  /** Degrees in half a turn: an angle in radians. */
  halfTurn: 180,
} as const;

/** A transform's 2D part as [a, b, c, d]: the identity, and the entries matrix() and matrix3d() give it from. */
export const TRANSFORM = { identity: [1, 0, 0, 1], matrix: [0, 1, 2, 3], matrix3d: [0, 1, 4, 5], one: 1 } as const;

/** CSS functions a transform is read from, in lower case; a translation leaves the 2D part as it is. */
export const TRANSFORM_FUNCTION = {
  matrix: "matrix",
  matrix3d: "matrix3d",
  rotate: "rotate",
  rotateZ: "rotatez",
  scale: "scale",
  scaleX: "scalex",
  scaleY: "scaley",
  translate: "translate",
  translateX: "translatex",
  translateY: "translatey",
  translate3d: "translate3d",
} as const;

export const BUILD_STYLES_WORD = {
  none: "none",
  normal: "normal",
  bold: "bold",
  italic: "italic",
  inset: "inset",
  auto: "auto",
  px: "px",
  em: "em",
  percent: "%",
  colon: ":",
  /** A custom property's start: kept as given. */
  custom: "--",
} as const;

/** flex's keywords as the grow they give. */
export const FLEX_GROWS: Readonly<Record<string, string>> = { none: "0", auto: "1" };

/** The longhands a computed style holds that design_read writes as part of a shorthand. */
export const LONGHAND = {
  overflowX: "overflow-x",
  overflowY: "overflow-y",
  backgroundColor: "background-color",
  backgroundImage: "background-image",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  fontStyle: "font-style",
  lineHeight: "line-height",
  flexGrow: "flex-grow",
  decorationLine: "text-decoration-line",
  decorationStyle: "text-decoration-style",
  decorationColor: "text-decoration-color",
} as const;

export const SIDES = ["top", "right", "bottom", "left"] as const;

export const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

export const BORDER_STYLES: readonly string[] = [
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
];

export const DECORATION_LINES: readonly string[] = ["none", "underline", "overline", "line-through"];

export const DECORATION_STYLES: readonly string[] = ["solid", "double", "dotted", "dashed", "wavy"];

/** A flex lays its children out on one line unless it wraps: then only its main axis's gap shows. */
export const FLEX_WORDS = {
  displays: ["flex", "inline-flex"] as readonly string[],
  wraps: ["wrap", "wrap-reverse"] as readonly string[],
  columns: ["column", "column-reverse"] as readonly string[],
} as const;

/** How a property's computed value is compared, when not as a keyword. */
export const LONGHAND_KINDS: Readonly<Record<string, (typeof LONGHAND_KIND)[keyof typeof LONGHAND_KIND]>> = {
  [CSS_PROPERTY.width]: LONGHAND_KIND.box,
  [CSS_PROPERTY.height]: LONGHAND_KIND.box,
  [CSS_PROPERTY.minWidth]: LONGHAND_KIND.box,
  [CSS_PROPERTY.maxWidth]: LONGHAND_KIND.box,
  [CSS_PROPERTY.minHeight]: LONGHAND_KIND.box,
  [CSS_PROPERTY.maxHeight]: LONGHAND_KIND.box,
  [CSS_PROPERTY.left]: LONGHAND_KIND.box,
  [CSS_PROPERTY.right]: LONGHAND_KIND.box,
  [CSS_PROPERTY.top]: LONGHAND_KIND.box,
  [CSS_PROPERTY.bottom]: LONGHAND_KIND.box,
  [CSS_PROPERTY.rowGap]: LONGHAND_KIND.length,
  [CSS_PROPERTY.columnGap]: LONGHAND_KIND.length,
  [CSS_PROPERTY.paddingTop]: LONGHAND_KIND.length,
  [CSS_PROPERTY.paddingRight]: LONGHAND_KIND.length,
  [CSS_PROPERTY.paddingBottom]: LONGHAND_KIND.length,
  [CSS_PROPERTY.paddingLeft]: LONGHAND_KIND.length,
  [CSS_PROPERTY.letterSpacing]: LONGHAND_KIND.length,
  [CSS_PROPERTY.textUnderlineOffset]: LONGHAND_KIND.length,
  [CSS_PROPERTY.textDecorationThickness]: LONGHAND_KIND.length,
  [CSS_PROPERTY.opacity]: LONGHAND_KIND.number,
  [CSS_PROPERTY.color]: LONGHAND_KIND.color,
  [CSS_PROPERTY.boxShadow]: LONGHAND_KIND.shadows,
  [CSS_PROPERTY.textShadow]: LONGHAND_KIND.shadows,
  [CSS_PROPERTY.transform]: LONGHAND_KIND.transform,
  [CSS_PROPERTY.gridTemplateColumns]: LONGHAND_KIND.tracks,
  [CSS_PROPERTY.gridTemplateRows]: LONGHAND_KIND.tracks,
};

const START = ["flex-start", "start"];
const END = ["flex-end", "end"];

/** Keywords that show the same though spelled apart, by property. */
export const SYNONYMS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  [CSS_PROPERTY.justifyContent]: [["normal", ...START], END],
  [CSS_PROPERTY.alignItems]: [START, END],
  [CSS_PROPERTY.alignContent]: [START, END],
  [CSS_PROPERTY.alignSelf]: [
    [...START, "self-start"],
    [...END, "self-end"],
  ],
  [CSS_PROPERTY.justifySelf]: [
    [...START, "self-start", "left"],
    [...END, "self-end", "right"],
  ],
  [CSS_PROPERTY.textAlign]: [
    ["left", "start"],
    ["right", "end"],
  ],
  [LONGHAND.overflowX]: [["hidden", "clip"]],
  [LONGHAND.overflowY]: [["hidden", "clip"]],
  [LONGHAND.fontStyle]: [["italic", "oblique"]],
};

export const BUILD_STYLES_PATTERN = {
  /** A background layer that is an image: a gradient or a file. */
  imageLayer: /^(?:repeating-)?(?:linear|radial|conic)-gradient\(|^url\(/i,
  /** A colour mixed with transparent at a percent: how design_read writes a token at an opacity. */
  mixed: /^color-mix\(\s*in\s+[a-z0-9-]+\s*,\s*(.+?)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/i,
  /** A transform function with its arguments. */
  function: /^([a-z0-9]+)\(([\s\S]*)\)$/i,
  /** A capital in a style object's key: backgroundColor. */
  capital: /[A-Z]/g,
  quotes: /["']/g,
  spaces: /\s+/g,
} as const;

export const BUILD_STYLES_TEXT = {
  side: (prefix: string, side: string) => `${prefix}-${side}`,
  corner: (corner: string) => `border-${corner}-radius`,
  strokeWidth: (prefix: string) => `${prefix}-width`,
  strokeStyle: (prefix: string) => `${prefix}-style`,
  strokeColor: (prefix: string) => `${prefix}-color`,
  /** A style object's key as CSS spells it: backgroundColor is background-color. */
  kebab: (capital: string) => `-${capital.toLowerCase()}`,
  px: (value: number) => `${value}px`,
  fromStyle: (name: string) => `textStyle="${name}"`,
  hidden: (name: string, id: string) =>
    `${name} (${id}) is hidden in the design, so its read holds no styles: show it and compare it again.`,
  drawn: (name: string, id: string) =>
    `${name} (${id}) is drawn as part of an icon or an image: compare that one instead.`,
  notGiven:
    "notGiven lists what the design sets and css left out: read those properties with getComputedStyle and call again.",
} as const;

export const BUILD_STYLES_FIELD = {
  matched: "Properties the build has as the design sets them.",
  design: "The design's value, its tokens' values in.",
  from: 'What the design takes it from: a token, var(--name), or a text style, textStyle="Name".',
  build: "The build's computed value.",
  mismatches: "Properties the build has otherwise, in the design's order.",
  notGiven: "Properties the design sets that the build's styles leave out: read them too and compare again.",
  notCompared:
    "What the design writes in a way a computed style cannot be held against: an offset in percent or calc(), tracks in fr, a value in em without a font size.",
  tag: "Its element in design_read: Frame, Text, Icon…",
  layers: "Each pair's layer: what matched, what differs, what the build left out, what cannot be compared.",
  missing: "Layers the file does not hold.",
  same: "The build gave every property the design sets and each one matched (notCompared aside).",
} as const;
