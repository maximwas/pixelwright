/**
 * npm's answer for the newest release (S-070); the dev channel's package is still `pixelwright`. A slow registry never
 * holds the server: past 3 s the last kept answer stands.
 */
export const NPM_LATEST = { url: "https://registry.npmjs.org/pixelwright/latest", timeoutMs: 3_000 } as const;

/**
 * Fontsource's API (A§15.5): documented and keyless, every family Google Fonts serves with its weights and styles.
 * fonts_check waits 8 s for it, as 0.7.0 waited for Google, before it asks Google's own catalogue.
 */
export const FONTSOURCE = {
  url: "https://api.fontsource.org/v1/fonts?type=google",
  timeoutMs: 8_000,
  italic: "italic",
} as const;

/**
 * Google Fonts' own catalogue (D-37), fonts_check's fallback: undocumented and keyless; its answer may open with a
 * )]}' line that keeps it from running as a script; an italic's key ends in i ("400i").
 */
export const GOOGLE_METADATA = {
  url: "https://fonts.google.com/metadata/fonts",
  timeoutMs: 8_000,
  guard: /^\)\]\}'\s*/,
  italic: "i",
} as const;

export const HTTP_TEXT = { answered: (url: string, status: number) => `${url} answered ${status}` } as const;
