/**
 * What a double-quoted attribute value may not hold raw (§1.1): markup, its quote, and line breaks, which become
 * references so each tag stays on one line.
 */
export const ATTRIBUTE_ESCAPE = {
  pattern: /[&<>"\n\r\t\u2028\u2029]/g,
  references: {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "\n": "&#10;",
    "\r": "&#13;",
    "\t": "&#9;",
    "\u2028": "&#8232;",
    "\u2029": "&#8233;",
  },
} as const;

/** Light XML's layout (C-009): one tag per line, two spaces a level. */
export const XML = {
  indent: "  ",
  lineBreak: "\n",
  attribute: (name: string, value: string) => ` ${name}="${value}"`,
  leaf: (
    indent: string,
    tag: string,
    attributes: string,
  ) => `${indent}<${tag}${attributes}/>`,
  open: (
    indent: string,
    tag: string,
    attributes: string,
  ) => `${indent}<${tag}${attributes}>`,
  close: (indent: string, tag: string) => `${indent}</${tag}>`,
  /** A Text: its content between its tags, on its line; a Span is the same without the indent. */
  text: (
    indent: string,
    tag: string,
    attributes: string,
    content: string,
  ) =>
    `${indent}<${tag}${attributes}>${content}</${tag}>`,
  spanTag: "Span",
} as const;

/**
 * What a Text's characters may not hold raw between its tags (§1.1): markup and line breaks, which become the
 * attribute table's references. A text of spaces only writes its spaces as references: a parser that trims drops them.
 */
export const TEXT_ESCAPE = { pattern: /[&<>\n\r\t\u2028\u2029]/g, space: / /g, spaceReference: "&#32;" } as const;

/** The pieces of a Text's content: its plain characters, and a Span with what it sets over the text's own. */
export const XML_CONTENT = { text: "text", span: "span" } as const;
