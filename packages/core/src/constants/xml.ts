/** A tag or attribute name: letters, digits, `$` (read-only attributes) and the usual XML name characters. */
export const XML_NAME = /[A-Za-z_$][\w$.:-]*/y;

/** An entity reference: hexadecimal, decimal or named. */
export const XML_ENTITY = /&(?:#x([0-9A-Fa-f]+)|#(\d+)|([A-Za-z]+));/y;

export const XML_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Comments and processing instructions: read past, nothing in the tree. */
export const XML_SKIPPED: readonly (readonly [string, string])[] = [
  ["<!--", "-->"],
  ["<?", "?>"],
];

export const XML_CDATA_OPEN = "<![CDATA[";

export const XML_CDATA_CLOSE = "]]>";
