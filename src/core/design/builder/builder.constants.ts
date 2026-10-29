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

/** Figma's annotation property types as `$pins` words them (C-1.5): CSS words; a type Figma adds later stays as named. */
export const PIN_WORDS: Readonly<Record<string, string>> = {
  width: "width",
  height: "height",
  minWidth: "min-width",
  maxWidth: "max-width",
  minHeight: "min-height",
  maxHeight: "max-height",
  fills: "background",
  strokes: "border",
  effects: "box-shadow",
  strokeWeight: "border-width",
  cornerRadius: "border-radius",
  textStyleId: "text style",
  textAlignHorizontal: "text-align",
  fontFamily: "font-family",
  fontStyle: "font-style",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  itemSpacing: "gap",
  padding: "padding",
  layoutMode: "flex-direction",
  alignItems: "align-items",
  opacity: "opacity",
  mainComponent: "component",
  gridRowGap: "row-gap",
  gridColumnGap: "column-gap",
  gridRowCount: "grid rows",
  gridColumnCount: "grid columns",
  gridRowAnchorIndex: "grid-row",
  gridRowSpan: "grid-row",
  gridColumnAnchorIndex: "grid-column",
  gridColumnSpan: "grid-column",
};

/** A text layer's fills are its text colour. */
export const TEXT_PIN_WORDS: Readonly<Record<string, string>> = { fills: "color" };

export const PINS = { separator: ", " } as const;
