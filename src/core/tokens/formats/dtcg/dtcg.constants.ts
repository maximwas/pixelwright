import { FIGMA_EFFECT } from "@/core/css/groups/effects/effects.constants.ts";

/** The DTCG 2025.10 types this format writes (Design Tokens Format Module). */
export const DTCG_TYPE = {
  color: "color",
  dimension: "dimension",
  fontWeight: "fontWeight",
  number: "number",
  fontFamily: "fontFamily",
  typography: "typography",
  shadow: "shadow",
  gradient: "gradient",
} as const;

/**
 * K-015: a number scoped only to lengths is a `dimension` in px, only to weights a `fontWeight`; a text scoped only to
 * font families is a `fontFamily`.
 */
export const DTCG_SCOPE = {
  lengths: [
    "WIDTH_HEIGHT",
    "GAP",
    "CORNER_RADIUS",
    "STROKE_FLOAT",
    "FONT_SIZE",
    "LINE_HEIGHT",
    "LETTER_SPACING",
    "PARAGRAPH_SPACING",
    "PARAGRAPH_INDENT",
    "EFFECT_FLOAT",
  ] as readonly string[],
  fontWeight: "FONT_WEIGHT",
  fontFamily: "FONT_FAMILY",
} as const;

/** Effects DTCG has a type for: shadows, `inset` for an inner one. */
export const DTCG_SHADOWS: Readonly<Record<string, boolean>> = {
  [FIGMA_EFFECT.dropShadow]: false,
  [FIGMA_EFFECT.innerShadow]: true,
};

/** The colour Figma gives a shadow without one. */
export const DTCG_SHADOW_COLOR = { r: 0, g: 0, b: 0, a: 0.25 } as const;

export const DTCG_KEY = {
  type: "$type",
  /** A group's own token, when a token's path is also a group (DTCG 2025.10). */
  root: "$root",
  /** The tree of the styles; a collection of that name gets another key. */
  styles: "styles",
  px: "px",
  /** Figma's gradient paint types all start so. */
  gradient: "GRADIENT_",
  /** A variable font's weight axis. */
  weightAxis: "wght",
  slash: "/",
  dash: "-",
  none: "",
} as const;

export const DTCG_NUMBER = {
  /** Figma's Auto line height as DTCG gets it: CSS's `normal`, about 1.2 times the size for most fonts. */
  autoLineHeight: 1.2,
  /** An opacity: Figma keeps a composed colour's in percent, and a value up to 1 is a fraction already. */
  opaque: 1,
  percent: 100,
  /** Aliases followed to resolve a composed colour: Figma refuses a loop, the bound guards a broken file. */
  aliasHops: 16,
  /** The number the second path or key that wants a taken one gets. */
  firstCopy: 2,
} as const;

export const DTCG_PATTERN = {
  /** DTCG reserves `.`, `{` and `}` in a name, and `$` at its start. */
  reserved: /[.{}]/g,
  leadingDollar: /^\$+/,
  /** A tree's key keeps letters and digits of any script, the rest as "-". */
  other: /[^\p{L}\p{N}]+/gu,
  edgeDashes: /^-|-$/g,
} as const;

export const DTCG_TEXT = {
  reference: (path: readonly string[]) => `{${path.join(".")}}`,
  key: (collection: string, mode: string) => `${collection}.${mode}`,
  typed: (name: string, type: string) => `${name} (${type})`,
  kind: (name: string, type: string) => `${name} (${type.toLowerCase()})`,
} as const;

export const DTCG_NOTE = {
  renamedCollection: (
    name: string,
    key: string,
    wanted: string,
  ) =>
    `The collection ${name} is written as ${key}: ${wanted} is taken.`,
  samePath: (name: string, path: readonly string[]) =>
    `${name} has the same DTCG path as another token: written as ${path.join(".")}.`,
  untyped: (listed: readonly string[]) =>
    `${listed.length} variable${listed.length === 1 ? " has" : "s have"} no DTCG type and ${
      listed.length === 1 ? "is" : "are"
    } left out: ${listed.join(", ")}.`,
  lost: (name: string) =>
    `${name} points at a variable that is neither in this file nor in a library it uses: left out.`,
  outside: (name: string, where: string) => `${name} points at ${where}`,
  leftOut: (name: string, collection: string) =>
    `${name} in ${collection}, which this output leaves out: add it to collections for the reference to resolve.`,
  library: (name: string, collection: string) =>
    `${name} from a library (${collection}): no file here defines it, so add that library's tokens for the reference to resolve.`,
  resolved: (name: string, mode: string) =>
    `${name} (${mode}) is a colour at an opacity with a variable in it: DTCG cannot fade a reference, so it is written resolved.`,
  unfaded: (name: string, mode: string) =>
    `${name} (${mode}) is a colour at an opacity whose colour cannot be resolved here: written as a reference to that colour, without its opacity.`,
  unwritable: (name: string, mode: string) => `${name} (${mode}) holds no value DTCG can write as its type: left out.`,
  untypedStyles: (listed: readonly string[]) =>
    `${listed.join(", ")}: no DTCG type for ${listed.length === 1 ? "this style" : "these styles"}, left out.`,
  autoLineHeight: (names: readonly string[], ratio: number) =>
    `${names.join(", ")}: Auto line height, written as ${ratio} (CSS's normal); give the style a line height in Figma to match exactly.`,
  weightGuess: (names: readonly string[]) =>
    `${names.join(", ")}: fontWeight is guessed from the font style's name (Semi Bold 600, Bold 700), since a text style keeps no weight of its own; a variable font's real weight can differ.`,
} as const;
