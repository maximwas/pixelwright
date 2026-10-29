export const STYLE_NUMBERS = {
  /** A name is numbered only when two styles of a kind share it. */
  shared: 2,
  /** The first of them keeps the plain name: number 1 is no suffix. */
  first: 1,
} as const;

export const STYLE_NUMBERS_TEXT = { key: (type: string, name: string) => `${type} ${name}` } as const;
