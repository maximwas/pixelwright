/** A weight from a style's name, for text styles (which carry no weight of their own): the first match wins. */
export const FONT_WEIGHTS: readonly (readonly [pattern: RegExp, weight: number])[] = [
  [/thin|hairline/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold/i, 800],
  [/black|heavy/i, 900],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
];

export const FONT_NUMBER = {
  /** A style whose name says no weight is regular. */
  regular: 400,
  /** Figma's percent of the font size, and CSS's em: 1em is 100%. */
  percent: 100,
} as const;

/** Figma's units for a line height, letter spacing and a decoration's offset or thickness. */
export const FONT_UNIT = { pixels: "PIXELS", percent: "PERCENT" } as const;

export const FONT_PATTERN = {
  italic: /italic/i,
  /** O-021: what would end or escape the family's quoted CSS string. */
  unsafe: /['\\]/g,
} as const;

export const FONT_VALUE = { normal: "normal" } as const;

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
