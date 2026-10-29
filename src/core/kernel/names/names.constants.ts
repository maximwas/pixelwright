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
