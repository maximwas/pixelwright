/** The marks of a `Name=Value, Other=Value` list (K-069): between items, between a name and its value, the escape. */
export const LIST = {
  item: ",",
  pair: "=",
  escape: "\\",
  /** How write joins items: Figma's own variant names put a space after each comma. */
  itemJoiner: ", ",
  /** The replacement that puts the escape before the mark it matched. */
  escaped: "\\$&",
  /** The replacement that keeps the character an escape stood before. */
  unescaped: "$1",
} as const;

/** The marks write escapes, and an escape with the character it keeps. */
export const LIST_PATTERN = { marks: /[\\,=]/g, escape: /\\([\s\S])/g } as const;
