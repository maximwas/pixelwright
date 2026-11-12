/** design_apply as clients list it. */
export const DESIGN_APPLY_TOOL = {
  name: "design_apply",
  title: "Write a design",
  description:
    "Writes Pixelwright XML, the format design_read returns, into Figma. Strict XML: an unclosed tag, a wrong closing tag, a duplicate attribute, a bare & or a < in a value is refused as INVALID_XML with its line and column. Names may hold $ ($css), HTML entities like &mdash; are read, CDATA is text as written. An element with id changes that layer, only the attributes it gives; one without id creates a layer: Frame, Section, Text, Rectangle, Ellipse, Line, Component, ComponentSet of Components, Slot in a Component. New layers start bare and go into parent, else the current page beside its layers. This release writes names, visibility, auto layout (display, direction, wrap, gap, padding, alignment), width and height in px or auto, opacity, overflow, colour backgrounds and a Text's characters; any other attribute is refused on its element as not written yet. Each element is written on its own: errors come back with their line, column and attribute while the rest goes in, and the whole call is one undo step. XML read with design_read and sent back unchanged changes nothing. The plugin refuses writes while its Allow edits switch is off; dryRun runs the same checks in the plugin without writing and lists what it would create (without ids) and change, with the elements read, every refusal and the changes in Figma's terms; an element lists notWritten, the attributes no writer handles yet.",
} as const;

/** Why 2,000,000: 0.7.0 took that much XML in one call, about 20,000 lines. */
export const DESIGN_APPLY_LIMIT = { xmlChars: 2_000_000 } as const;

export const DESIGN_APPLY_FIELD = {
  xml: "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
  elements:
    "The elements read, in document order: line and column, tag, id (null for a new layer), ref (new:<line> for a new one), parent ref, index among its siblings, the attributes kept, a Text's content pieces, and for an element inside a copy its source and copy; notWritten lists the attributes no writer handles yet (left out of changes, not refused).",
  errors:
    "Every refusal, in document order: line and column, the id and attribute it concerns, the message and a hint. An element that is refused is not in elements; an attribute that is refused is left out of it.",
  parent:
    "Where top-level new layers go: a frame's, section's or page's id. Default: the current page, beside its layers.",
  created:
    "The layers made, by their element's line and ref, with their ids and names; a dry run's, which it would make, have neither.",
  changed: "The ids of the existing layers written to (a dry run's: would be).",
  changes:
    "What the call would make or change, in document order, in Figma's terms: kind (create or update), id, tag, props (only what the layer does not have yet) and sources (the attribute each prop came from). A layer that already looks as written is not listed.",
} as const;
