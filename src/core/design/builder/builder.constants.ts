/** Dev Mode notes as one attribute: `Category: label`, joined by ` | `; a bar or backslash inside a note is escaped. */
export const NOTE = {
  separator: " | ",
  marks: /[\\|]/g,
  escaped: "\\$&",
  categorised: (category: string, label: string) => `${category}: ${label}`,
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
} as const;
