/** design_apply as clients list it. */
export const DESIGN_APPLY_TOOL = {
  name: "design_apply",
  title: "Write a design",
  description:
    "Writes Pixelwright XML, the format design_read returns, into Figma. Strict XML: an unclosed tag, a wrong closing tag, a duplicate attribute, a bare & or a < in a value is refused as INVALID_XML with its line and column. Names may hold $ ($css), HTML entities like &mdash; are read, CDATA is text as written. dryRun checks the XML without writing.",
} as const;

/** Why 2,000,000: 0.7.0 took that much XML in one call, about 20,000 lines. */
export const DESIGN_APPLY_LIMIT = { xmlChars: 2_000_000 } as const;

export const DESIGN_APPLY_FIELD = {
  xml: "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
  elements: "How many elements the XML holds.",
} as const;

export const DESIGN_APPLY_TEXT = {
  notYet: "design_apply only checks XML for now: write with dryRun true. Writing to Figma comes in a later release.",
} as const;
