/** What a custom property's name keeps and how Dev Mode writes it (T-163, C-021). */
export const TOKEN_PATTERN = {
  /** What a custom property's name cannot hold: anything but letters and digits of any script, `_` and `-`. */
  unnamed: /[^\p{L}\p{N}_-]+/gu,
  edgeDashes: /^-+|-+$/g,
  /** A WEB code syntax written as var(--name, …). */
  wrapped: /^var\(\s*(--[^,)\s]+)/,
} as const;

export const TOKEN_VALUE = { dash: "-", none: "", prefix: "--" } as const;

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
