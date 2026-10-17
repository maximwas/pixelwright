/** Figma's variable scopes, in the order Figma keeps them: the fields whose pickers offer a variable. */
export const VARIABLE_SCOPES = [
  "ALL_SCOPES",
  "TEXT_CONTENT",
  "CORNER_RADIUS",
  "WIDTH_HEIGHT",
  "GAP",
  "ALL_FILLS",
  "FRAME_FILL",
  "SHAPE_FILL",
  "TEXT_FILL",
  "STROKE_COLOR",
  "STROKE_FLOAT",
  "EFFECT_FLOAT",
  "EFFECT_COLOR",
  "OPACITY",
  "COLOR_OPACITY",
  "FONT_FAMILY",
  "FONT_STYLE",
  "FONT_WEIGHT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
] as const;

export type VariableScopeName = (typeof VARIABLE_SCOPES)[number];

/** The platforms a variable's code syntax names it on. */
export const CODE_SYNTAX_PLATFORMS = ["WEB", "ANDROID", "iOS"] as const;

export type CodeSyntaxPlatform = (typeof CODE_SYNTAX_PLATFORMS)[number];

/** A variable's name in code, per platform. */
export type CodeSyntax = Partial<Record<CodeSyntaxPlatform, string>>;

/** The scopes Figma lets each type take (seen live on 2026-10-17: any other throws "Invalid scope for this variable type"). */
const TYPE_SCOPES: Readonly<Record<string, readonly VariableScopeName[]>> = {
  COLOR: ["ALL_SCOPES", "ALL_FILLS", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR", "EFFECT_COLOR"],
  FLOAT: [
    "ALL_SCOPES",
    "TEXT_CONTENT",
    "CORNER_RADIUS",
    "WIDTH_HEIGHT",
    "GAP",
    "STROKE_FLOAT",
    "EFFECT_FLOAT",
    "OPACITY",
    "COLOR_OPACITY",
    "FONT_WEIGHT",
    "FONT_SIZE",
    "LINE_HEIGHT",
    "LETTER_SPACING",
    "PARAGRAPH_SPACING",
    "PARAGRAPH_INDENT",
  ],
  STRING: ["ALL_SCOPES", "TEXT_CONTENT", "FONT_FAMILY", "FONT_STYLE"],
  BOOLEAN: ["ALL_SCOPES"],
};

const FILL_SCOPES: readonly string[] = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"];

/** Why Figma would refuse these scopes on a variable of this type; null when it takes them. */
export function scopesError(type: string, scopes: readonly string[]): string | null {
  const allowed: readonly string[] | undefined = TYPE_SCOPES[type];

  if (allowed === undefined) {
    return null;
  }

  const refused = scopes.filter((scope) => !allowed.includes(scope));

  if (refused.length > 0) {
    return `A ${type} variable cannot take ${refused.join(", ")}: its scopes are ${allowed.join(", ")}.`;
  }

  if (scopes.includes("ALL_SCOPES") && scopes.length > 1) {
    return "ALL_SCOPES stands alone: it already offers the variable for every field.";
  }

  if (scopes.includes("ALL_FILLS") && scopes.some((scope) => FILL_SCOPES.includes(scope))) {
    return "ALL_FILLS already covers FRAME_FILL, SHAPE_FILL and TEXT_FILL: give it or them.";
  }

  return type === "BOOLEAN" && scopes.length === 0
    ? "A BOOLEAN variable is offered for every field: its scopes can only be ALL_SCOPES."
    : null;
}

/** Whether two lists of scopes offer a variable for the same fields (Figma keeps them in its own order). */
export function sameScopes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((scope) => b.includes(scope));
}

/** Whether a variable offered for these fields is a variable for every field: what Figma gives a new one. */
export function everyField(scopes: readonly string[]): boolean {
  return sameScopes(scopes, ["ALL_SCOPES"]);
}

/** How a number variable's values read in CSS: a length in px, a plain number, or an opacity (a fraction). */
export type NumberUnit = "px" | "number" | "opacity";

/** Scopes whose numbers have no unit: a font weight, a number shown as text, an opacity. */
const UNITLESS_SCOPES: readonly string[] = ["FONT_WEIGHT", "TEXT_CONTENT", "OPACITY", "COLOR_OPACITY"];

const OPACITY_SCOPES: readonly string[] = ["OPACITY", "COLOR_OPACITY"];

/** The unit a number's scopes give it; null when they say nothing of it (no field, or every field). */
export function scopedUnit(scopes: readonly string[]): NumberUnit | null {
  if (scopes.length === 0 || scopes.includes("ALL_SCOPES")) {
    return null;
  }

  if (!scopes.every((scope) => UNITLESS_SCOPES.includes(scope))) {
    return "px";
  }

  return scopes.some((scope) => OPACITY_SCOPES.includes(scope)) ? "opacity" : "number";
}
