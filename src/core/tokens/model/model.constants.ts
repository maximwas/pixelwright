/** Figma's variable types (T-164). */
export const VARIABLE_TYPE = {
  color: "COLOR",
  float: "FLOAT",
  string: "STRING",
  boolean: "BOOLEAN",
  easing: "EASING",
  timing: "TIMING",
} as const;

/** An alias's type, and the scopes of a variable offered for every field. */
export const VARIABLE_VALUE = { alias: "VARIABLE_ALIAS", allScopes: "ALL_SCOPES", fallback: "initial" } as const;

/** How a number variable's values read in CSS (K-003): a length in px, a plain number, or an opacity (a fraction). */
export const NUMBER_UNIT = { px: "px", number: "number", opacity: "opacity" } as const;

/** Scopes whose numbers have no unit (K-003): a font weight, a number shown as text, an opacity. */
export const UNITLESS_SCOPES: readonly string[] = ["FONT_WEIGHT", "TEXT_CONTENT", "OPACITY", "COLOR_OPACITY"];

export const OPACITY_SCOPES: readonly string[] = ["OPACITY", "COLOR_OPACITY"];

export const MODEL_NUMBER = {
  /** Figma keeps an opacity in percents in its fields, and a composed colour's too; up to 1 it already is a fraction. */
  percent: 100,
  fraction: 1,
  /** The second collection or mode that would share a selector is "-2". */
  firstCopy: 2,
} as const;

/** The style groups by Figma's style type; grid styles never reach code. */
export const STYLE_GROUP = { paint: "paint", text: "text", effect: "effect" } as const;

export type StyleGroup = (typeof STYLE_GROUP)[keyof typeof STYLE_GROUP];

export const STYLE_GROUPS: Readonly<Record<string, StyleGroup>> = {
  PAINT: STYLE_GROUP.paint,
  TEXT: STYLE_GROUP.text,
  EFFECT: STYLE_GROUP.effect,
};

/** The order notes about same-named styles come in, each with its label. */
export const NOTED_GROUPS = [
  ["Paint", STYLE_GROUP.paint],
  ["Effect", STYLE_GROUP.effect],
  ["Text", STYLE_GROUP.text],
] as const;

export const MODEL_VALUE = {
  /** An opacity variable is a fraction in CSS (0.5 is half): a composed colour takes it as 100%. */
  wholePercent: "100%",
  /** Any other number is percents already. */
  onePercent: "1%",
  font: "font",
} as const;

export const MODEL_TEXT = {
  number: (value: number) => `${value}`,
  px: (value: number) => (value === 0 ? "0" : `${value}px`),
  seconds: (value: number) => `${value}s`,
  percent: (value: number) => `${value}%`,
  quoted: (value: string) => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`,
  mix: (color: string, opacity: string) => `color-mix(in srgb, ${color} ${opacity}, transparent)`,
  scaled: (value: string, unit: string) => `calc(${value} * ${unit})`,
  comment: (value: string) => `/* ${value} */`,
  unresolved: (id: string) => `/* unresolved alias ${id} */`,
  copy: (name: string, number: number) => `${name}-${number}`,
  selector: (attribute: string, value: string) => `[${attribute}="${value}"]`,
  part: (token: string, property: string) => `${token}-${property}`,
  kinds: (types: readonly string[]) => types.map((type) => type.toLowerCase()).join(" + ") || "empty",
  pair: (token: string, value: string) => `${token} ${value}`,
  list: (items: readonly string[]) => items.join(", "),
} as const;

/** What a token output could not write as asked (T-164, K-005, K-006). */
export const MODEL_NOTE = {
  unresolved: (name: string, id: string) =>
    `${name} points at variable ${id}, which is neither in this file nor in a library it uses.`,
  unknown: (
    name: string,
    type: string,
    value: string,
  ) => `${name} has a ${type} value CSS cannot hold: ${value}.`,
  boolean: (name: string) => `${name} is a boolean: CSS has no booleans, it is written as true or false.`,
  sharedSelector: (
    mode: string,
    collection: string,
    wanted: string,
    slug: string,
  ) =>
    `Mode "${mode}" of ${collection} would share the selector value "${wanted}": it is "${slug}".`,
  missing: (token: string, home: string) =>
    `${token} is used but not in this output: it is in ${home}; add that collection to collections.`,
  nowhere: (token: string) => `${token} is used but defined nowhere in this output.`,
  library: (collection: string) => (collection === "" ? "a library" : `${collection} (a library)`),
  paint: (name: string, kinds: string) =>
    `Paint style ${name} is ${kinds}: CSS cannot draw it as a token (an image, a diamond or a turned radial gradient, or one without stops).`,
  effect: (name: string) => `Effect style ${name} holds no shadow or blur CSS can write.`,
  sameNames: (
    label: string,
    name: string,
    count: number,
    tokens: string,
  ) =>
    `${label} styles named ${name} are ${count} different styles: ${tokens}.`,
} as const;

/** The token model's field descriptions, as clients read them. */
export const MODEL_FIELD = {
  also: "A text style's letter spacing and case, an effect style's blurs, as tokens of their own.",
  scopes: "The fields Figma's pickers offer it for, when not every field: [] hides it from all.",
} as const;
