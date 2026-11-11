/** design_apply as clients list it. */
export const DESIGN_APPLY_TOOL = {
  name: "design_apply",
  title: "Write a design",
  description:
    "Writes Pixelwright XML, the format design_read returns, into Figma. Strict XML: an unclosed tag, a wrong closing tag, a duplicate attribute, a bare & or a < in a value is refused as INVALID_XML with its line and column. Names may hold $ ($css), HTML entities like &mdash; are read, CDATA is text as written. dryRun reads the XML without writing and answers the elements it read, every refusal (an unknown attribute, a Did you mean hint, a habit such as x or fill with the CSS to write instead) and the changes it would make to the layers named, layout first: display, direction, gap, padding, alignment and grid tracks; an element lists notWritten, the attributes no writer handles yet, which are not in the changes.",
} as const;

/** Why 2,000,000: 0.7.0 took that much XML in one call, about 20,000 lines. */
export const DESIGN_APPLY_LIMIT = { xmlChars: 2_000_000 } as const;

export const DESIGN_APPLY_FIELD = {
  xml: "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
  elements:
    "The elements read, in document order: line and column, tag, id (null for a new layer), ref (new:<line> for a new one), parent ref, index among its siblings, the attributes kept, a Text's content pieces, and for an element inside a copy its source and copy; notWritten lists the attributes no writer handles yet (left out of changes, not refused).",
  errors:
    "Every refusal, in document order: line and column, the id and attribute it concerns, the message and a hint. An element that is refused is not in elements; an attribute that is refused is left out of it.",
  changes:
    "What the call would make or change, in document order, in Figma's terms: kind (create or update), id, tag, props (only what the layer does not have yet) and sources (the attribute each prop came from). A layer that already looks as written is not listed.",
} as const;

export const DESIGN_APPLY_TEXT = {
  notYet: "design_apply only checks XML for now: write with dryRun true. Writing to Figma comes in a later release.",
} as const;
