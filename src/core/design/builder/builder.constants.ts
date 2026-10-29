/**
 * The instance properties an element lists: the variant's values in `variant`; the instance's own texts and toggles in
 * `props` (a swapped instance and a slot show as children).
 */
export const PROPERTY_TYPES = { variant: { VARIANT: "VARIANT" }, own: { TEXT: "TEXT", BOOLEAN: "BOOLEAN" } } as const;

/** The fields a component's layer binds to its properties (componentPropertyReferences): text, visibility, swap. */
export const PROPERTY_FIELD = { characters: "characters", visible: "visible", mainComponent: "mainComponent" } as const;

/** Figma suffixes a non-variant property's name with its id ("Label#12:0"); people read the bare name. */
export const PROPERTY_NAME = { idSuffix: /#[^#]*$/ } as const;

/** Dev Mode notes as one attribute: `Category: label`, joined by ` | `; a bar or backslash inside a note is escaped. */
export const NOTE = {
  separator: " | ",
  marks: /[\\|]/g,
  escaped: "\\$&",
  categorised: (category: string, label: string) => `${category}: ${label}`,
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
