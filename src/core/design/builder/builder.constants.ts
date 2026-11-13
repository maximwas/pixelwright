/**
 * Dev Mode notes as one attribute: `Category: label [pins]`, joined by ` | `; a bar, backslash or bracket inside a
 * note's text is escaped, so its closing bracket is only ever its pins.
 */
export const NOTE = {
  separator: " | ",
  marks: /[\\|[]/g,
  escaped: "\\$&",
  categorised: (category: string, label: string) => `${category}: ${label}`,
  /** The properties a note pins close it; a note of pins alone is its bracket. */
  pinned: (text: string, words: string) => (text === "" ? `[${words}]` : `${text.trimEnd()} [${words}]`),
} as const;

/** The CSS design_apply cannot write back, as one `$css` attribute: `property: value`, joined by `; `. */
export const CSS_NOTES = {
  separator: "; ",
  line: (property: string, value: string) => `${property}: ${value}`,
} as const;

/** A layer's Dev Mode status, as design_read words it on the read's root. */
export const DEV_STATUS_WORDS = { ready: "ready for dev", completed: "completed" } as const;

export const BUILDER_VALUE = {
  /** A mask whose kind Figma does not give clips by its alpha. */
  defaultMask: "ALPHA",
  /** A flag attribute that is on. */
  on: "true",
  /** A hidden layer's stub: in CSS space it is not shown (D-18). */
  hidden: "none",
  /** The hyperlink type that opens a URL; the other kind links to a layer. */
  urlLink: "URL",
  /** HTML's target for a link that opens in a new tab. */
  newTab: "_blank",
} as const;
