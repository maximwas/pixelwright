/** Where CSS values split at their top level. */
export const CSS_SEPARATOR = { comma: ",", space: " ", slash: "/", semicolon: ";" } as const;

export const CSS_PATTERN = {
  /** A length in px or a bare number: "12px", "0", "-1.5px", "1.5". */
  length: /^(-?\d*\.?\d+)(px)?$/,
  /** A plain number: "363", "0.5". */
  bare: /^-?\d*\.?\d+$/,
  /** `var(--name)` or `var(--name, fallback)`: the token's name. */
  token: /^var\(\s*(--[^,)\s]+)\s*(?:,.*)?\)$/s,
  /** A run of whitespace, written as one space. */
  spaces: /\s+/g,
} as const;

export const CSS_VALUE = {
  /** A zero length, without a unit as CSS allows. */
  zero: "0",
  px: (pixels: number) => `${pixels}px`,
  /** The function that names a token. */
  var: "var",
  varOpen: "var(",
  space: " ",
} as const;
