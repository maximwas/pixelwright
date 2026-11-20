/** What tokens_apply names as made, changed or refused (K-023). */
export const TOKEN_KIND = {
  collection: "collection",
  mode: "mode",
  variable: "variable",
  paint: "paint",
  text: "text",
  effect: "effect",
} as const;

/** The variable types tokens_apply writes; EASING and TIMING are read only (D-28). */
export const WRITABLE_TYPE = { COLOR: "COLOR", FLOAT: "FLOAT", STRING: "STRING", BOOLEAN: "BOOLEAN" } as const;

/** The field a planned value's kind is in. */
export const PLAN_VALUE_FIELD = "kind";

/** The kinds of a planned value: Figma's own, and an alias by its target's token. */
export const PLAN_VALUE = {
  color: "color",
  number: "number",
  string: "string",
  boolean: "boolean",
  alias: "alias",
} as const;
