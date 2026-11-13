export const FONT_NUMBER = {
  /** Figma's percent of the font size, and CSS's em: 1em is 100%. */
  percent: 100,
} as const;

/** Figma's units for a line height, letter spacing and a decoration's offset or thickness. */
export const FONT_UNIT = { pixels: "PIXELS", percent: "PERCENT" } as const;

export const FONT_PATTERN = {
  italic: /italic/i,
  /** `[italic] weight size/line-height families`, the shorthand design_read writes. */
  shorthand: /^(?:(italic|oblique|normal)\s+)?(?:(\d{1,4}|normal|bold)\s+)?(\d*\.?\d+)px(?:\s*\/\s*(\S+))?\s+(.+)$/,
  quotes: /^['"]|['"]$/g,
  em: /^(-?\d*\.?\d+)em$/,
  emSuffix: /em$/,
  pixels: /^(\d*\.?\d+)px$/,
  percent: /^(-?\d*\.?\d+)%$/,
  number: /^-?\d*\.?\d+$/,
  /** One font-variation-settings item: a quoted four-letter axis and its value, `'wght' 560`. */
  axis: /^(["'])([\x20-\x7E]{4})\1\s+(-?\d*\.?\d+)$/,
  /** O-021: what would end or escape the family's quoted CSS string. */
  unsafe: /['\\]/g,
} as const;

export const FONT_VALUE = {
  normal: "normal",
  bold: "bold",
  italic: "italic",
  oblique: "oblique",
  auto: "auto",
  /** CSS's numbers for normal and bold. */
  normalWeight: 400,
  boldWeight: 700,
} as const;

/** Figma's text case as text-transform; ORIGINAL is the default and left out (small caps are no transform). */
export const CASE_CSS: Readonly<Record<string, string>> = {
  UPPER: "uppercase",
  LOWER: "lowercase",
  TITLE: "capitalize",
};

/** What an Auto line height in px reads (T-060): where a text's lines end, and the fields that tell it. */
export const AUTO_LINE_HEIGHT = {
  /** Enter (a line feed, or U+2029) and Shift+Enter (U+2028). */
  lineBreak: /[\n\u2028\u2029]/,
  auto: "AUTO",
  pixels: "PIXELS",
  hugs: "WIDTH_AND_HEIGHT",
  text: "TEXT",
} as const;

export const FONT_TEXT = {
  shorthand: (
    italic: boolean,
    weight: number,
    size: string,
    family: string,
  ) =>
    `${italic ? "italic " : ""}${weight} ${size} '${family}'`,
  size: (size: string, lineHeight: string) => `${size}/${lineHeight}`,
  px: (value: number) => `${value}px`,
  em: (value: number) => `${value}em`,
  escaped: (character: string) => `\\${character}`,
} as const;
