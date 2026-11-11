/** A named version's limits (T-180): Figma's Version history shows a short title and a description under it. */
export const SAVE_VERSION = {
  /** A title a person reads in Version history at a glance: 0.7.0's limit. */
  titleChars: 100,
  /** A description Figma keeps whole: 0.7.0's VERSION_DESCRIPTION_CHARS. */
  descriptionChars: 1_000,
} as const;
