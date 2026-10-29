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
} as const;
