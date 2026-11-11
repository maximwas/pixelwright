/** The components op's notes on Dev Mode links (T-192, FX-065), 0.7.0's words. */
export const COMPONENT_LINKS_TEXT = {
  refused: (refusal: string) =>
    `Dev Mode links are not available in this file: Figma refused them (${refusal}); they come with a paid plan and a Full or Dev seat.`,
  timedOut: (ms: number) =>
    `Figma's servers gave no answer about Dev Mode links within ${ms / 1_000} s: they were not read.`,
  partly: (read: number) =>
    `Dev Mode links were read for the first ${read} components only: ask with query or a smaller limit for the rest.`,
  failed: (message: string) => `Dev Mode links could not be read: ${message}`,
} as const;

/** What a listed component says when Figma refused part of its details. */
export const COMPONENT_DETAILS_TEXT = {
  separator: " ",
  instancesFailed: "Some of its instances could not be listed: Figma refused them (a remote or unloadable component).",
  referencesFailed: "The layers bound to its properties could not be read: Figma refused them.",
} as const;

/** A property's name as Figma shows it: a non-variant property's carries its id after a #, "Label#12:0" (T-190). */
export const PROPERTY_NAME = { idSuffix: /#[^#]*$/ } as const;

/** A set's exposed instances are one entry per layer name and component, across its variants. */
export const EXPOSED_KEY = { of: (name: string, component: string) => `${name}\n${component}` } as const;
