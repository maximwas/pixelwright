export const XML_NODE_KIND = { text: "text", element: "element" } as const;

export const XML_PARSE = {
  // Letters, digits, `$` (read-only attributes such as `$css`) and the usual XML name characters; no library takes `$`.
  name: /^[A-Za-z_$][\w$.:-]*$/,
  entity: /&(?:#x([0-9A-Fa-f]+)|#(\d+)|([A-Za-z][A-Za-z0-9]*));/y,
  // Unicode ends here: a character reference above it, or 0, is no character.
  maxCodePoint: 0x10ffff,
  // How much of the text after a bad & the error quotes.
  entityPreview: 10,
  // XML's whitespace: a no-break or an em space is a character like any other (B-059).
  space: /^[ \t\r\n]*/,
  lineBreak: /\r\n|\n|\r/,
  tokenizer: { xmlMode: true, decodeEntities: false, recognizeSelfClosing: true },
  // `<![CDATA[` and `<!--` are this long before their content; the tokenizer reports the content only.
  cdataOpenChars: 9,
  commentOpenChars: 4,
  openChars: 1,
  closeChars: 2,
  declarationChars: 2,
  quotes: /["']/,
  chars: { amp: "&", lt: "<", newline: "\n", tab: "\t", space: " ", single: "'", double: '"', closeOpen: "</" },
} as const;

export const XML_PARSE_TEXT = {
  invalid: (
    line: number,
    column: number,
    reason: string,
  ) => `Invalid XML at line ${line}, column ${column}: ${reason}`,
  notClosed: (tag: string) => `<${tag}> is not closed.`,
  tagNotEnded: (tag: string) => `<${tag}> has no closing >.`,
  closesNothing: (tag: string) => `</${tag}> closes nothing.`,
  wrongClose: (
    expected: string,
    line: number,
    found: string,
  ) =>
    `Expected </${expected}> for the tag at line ${line}, found </${found}>.`,
  duplicate: (name: string) => `Attribute ${name} is given twice.`,
  needsQuotes: (name: string) => `The value of ${name} needs quotes: ${name}="…".`,
  badValue: (name: string, quote: string) =>
    `The value of ${name} is not closed with ${quote}, or holds a < (write &lt;).`,
  noEntity: (preview: string) => `"${preview}…" is no entity: write & as &amp;.`,
  expectedTagName: "Expected a tag name after <.",
  expectedAttribute: "Expected an attribute, > or />.",
  commentNotClosed: "<!-- is not closed with -->.",
  cdataNotClosed: "<![CDATA[ is not closed with ]]>.",
} as const;
