/** fonts_check as clients list it (tools.json pins every word), 0.7.0's words. */
export const FONTS_CHECK_TOOL = {
  name: "fonts_check",
  title: "Check the fonts",
  description:
    "The fonts a layer's texts use (the selected layer's by default), by family with the weights used, and where the build gets each: whether Google Fonts serves it, with a ready css2 link for those weights, and the weights it lacks; a family Google Fonts does not have needs its own files. Google Fonts' public catalogue is read once (no key); offline, the fonts are still listed.",
} as const;

export const FONTS_CHECK_FIELD = {
  node: "The layer whose texts' fonts to check (a section, a screen). Default: the one layer selected in Figma.",
  weights: 'The weights used, "400 italic" for an italic.',
  google: "Whether Google Fonts serves the family; null when it could not be reached.",
  css: "The Google Fonts css2 link for the weights used.",
} as const;

/** 0.7.0's words for the summary and each family (T-101). */
export const FONTS_CHECK_TEXT = {
  served: (families: number, google: number) => `${families} font families: ${google} on Google Fonts.`,
  offline: (families: number, error: string) =>
    `${families} font families. Google Fonts could not be reached (${error}): which are there is unknown.`,
  notServed: "Not on Google Fonts: the build needs its own files (a licence from its foundry, or a fallback).",
  missing: (weights: readonly string[]) =>
    `Google Fonts has no ${weights.join(", ")}: the nearest weight will stand in.`,
} as const;

/** The css2 link (T-101): the text shows at once in a fallback, swapped when the font loads; an italic as design_read
 * writes it, "400 italic". */
export const GOOGLE_CSS2 = { display: "swap", italic: " italic" } as const;
