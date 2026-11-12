/** What a custom property's name keeps and how Dev Mode writes it (T-163, C-021). */
export const TOKEN_PATTERN = {
  /** What a custom property's name cannot hold: anything but letters and digits of any script, `_` and `-`. */
  unnamed: /[^\p{L}\p{N}_-]+/gu,
  edgeDashes: /^-+|-+$/g,
  /** A WEB code syntax written as var(--name, …). */
  wrapped: /^var\(\s*(--[^,)\s]+)/,
} as const;

export const TOKEN_VALUE = { dash: "-", none: "", prefix: "--" } as const;

/**
 * A variable mode as the attribute tokens_read's CSS selects on (C-135): `data-<collection slug>="<mode slug>"`, a slug
 * lower case with letters and digits of any script, the rest as "-"; a name with none is "mode".
 */
export const MODE_ATTRIBUTE = {
  name: (slug: string) => `data-${slug}`,
  other: /[^\p{L}\p{N}]+/gu,
  empty: "mode",
} as const;

/** FNV-1a 32-bit (K-070): its offset basis and prime; base 36 keeps the hash short. Not cryptographic. */
export const FNV = { offset: 0x811c9dc5, prime: 0x01000193, radix: 36 } as const;

export const TOKEN_TEXT = {
  property: (name: string) => `--${name}`,
  hashed: (hash: string) => `--token-${hash}`,
  numbered: (name: string, number: number) => `${name}-${number}`,
  reference: (name: string) => `var(${name})`,
} as const;

/** How a layer name becomes a file name (K-075). */
export const SLUG_RULE = {
  /** NFKC folds ligatures and the like ("ﬁ" to "fi"). */
  form: "NFKC",
  /** Apostrophes join a word ("Kid's" to "kids"). */
  apostrophes: /['’]/g,
  /** Every run of anything but letters, digits and marks parts words: slugify's strict mode would run them together. */
  separators: /[^\p{L}\p{N}\p{M}]+/gu,
  trailingDashes: /-+$/,
  /** Cyrillic transliterated by the Ukrainian rules ("Логотип компанії" to "lohotyp-kompaniyi"). */
  locale: "uk",
  /** A file name stays readable and far below any file system's limit. */
  maxLength: 60,
  space: " ",
  none: "",
  /** The name of a layer whose name keeps nothing. */
  empty: "asset",
} as const;

/**
 * K-074: a font weight from its style's name, a guess (a text style keeps a font name, no weight). The first match
 * wins, so Semi Bold is found before Bold.
 */
export const FONT_WEIGHT_NAMES: readonly (readonly [pattern: RegExp, weight: number])[] = [
  [/thin|hairline/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold/i, 800],
  [/black|heavy/i, 900],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
];

/** A style whose name says no weight is regular. */
export const FONT_WEIGHT_NUMBER = { regular: 400 } as const;
