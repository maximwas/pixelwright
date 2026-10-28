const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "\n": "&#10;",
  "\r": "&#13;",
  "\t": "&#9;",
  "\u2028": "&#8232;",
  "\u2029": "&#8233;",
};

/** A value safe inside a double-quoted XML attribute; line breaks are kept as references so each tag stays on one line. */
export function escapeAttribute(value: string): string {
  return value.replace(/[&<>"\n\r\t\u2028\u2029]/g, (char) => ATTRIBUTE_ESCAPES[char] ?? char);
}
