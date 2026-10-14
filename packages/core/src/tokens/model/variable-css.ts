import { Color, isChannels } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { decimal } from "../../kernel/numbers.ts";
import { aliasOf } from "../aliases.ts";
import type { Notes } from "../notes.ts";
import type { RawVariable } from "../raw-tokens.ts";

/** What writing a variable's values needs: the CSS names aliases point at, the file's colour space, the notes. */
export interface VariableCssContext {
  readonly names: ReadonlyMap<string, string>;
  readonly space: ColorSpace;
  readonly notes: Notes;
}

/** Writes one mode's value of a variable of one type as CSS. */
type ValueCss = (value: unknown, variable: RawVariable, context: VariableCssContext) => string;

/** Scopes a number is used for without a unit; anything else (or no scope) is a length in pixels. */
const UNITLESS_SCOPES: ReadonlySet<string> = new Set(["OPACITY", "COLOR_OPACITY", "FONT_WEIGHT"]);

/** Figma's named easings as CSS keywords or curves. */
const EASINGS: ReadonlyMap<string, string> = new Map([
  ["LINEAR", "linear"],
  ["EASE_IN", "ease-in"],
  ["EASE_OUT", "ease-out"],
  ["EASE_IN_AND_OUT", "ease-in-out"],
  ["EASE_IN_BACK", "cubic-bezier(0.36, 0, 0.66, -0.56)"],
  ["EASE_OUT_BACK", "cubic-bezier(0.34, 1.56, 0.64, 1)"],
  ["EASE_IN_AND_OUT_BACK", "cubic-bezier(0.68, -0.6, 0.32, 1.6)"],
  ["HOLD", "step-end"],
]);

/** A writer per variable type; a type without one is written as a comment, with a note. */
const VALUE_CSS: ReadonlyMap<string, ValueCss> = new Map<string, ValueCss>([
  ["COLOR", colorCss],
  [
    "FLOAT",
    (value, variable, context) =>
      typeof value === "number" ? numberCss(value, variable.scopes) : unknownCss(value, variable, context),
  ],
  [
    "STRING",
    (value, variable, context) => (typeof value === "string" ? quoted(value) : unknownCss(value, variable, context)),
  ],
  ["BOOLEAN", booleanCss],
  ["EASING", easingCss],
  [
    "TIMING",
    (value, variable, context) =>
      typeof value === "number" ? `${decimal(value)}s` : unknownCss(value, variable, context),
  ],
]);

/**
 * A variable's value in one mode as CSS: an alias as `var(--target)`, anything else by the variable's type. What CSS
 * cannot hold is written as a comment, and a note says so.
 */
export function variableCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  const alias = aliasOf(value);

  if (alias !== null) {
    return aliasCss(alias, variable, context);
  }

  const write = VALUE_CSS.get(variable.resolvedType) ?? unknownCss;

  return write(value, variable, context);
}

function aliasCss(alias: string, variable: RawVariable, context: VariableCssContext): string {
  const target = context.names.get(alias);

  if (target === undefined) {
    context.notes.add(
      `${variable.name} points at variable ${alias}, which is neither in this file nor in a library it uses.`,
    );

    return `/* unresolved alias ${alias} */`;
  }

  return `var(${target})`;
}

/** A colour, or a composed one: a colour and an opacity, either of them a variable. */
function colorCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  if (isChannels(value)) {
    return Color.of(value, context.space).css();
  }

  if (typeof value !== "object" || value === null || !("color" in value) || !("opacity" in value)) {
    return unknownCss(value, variable, context);
  }

  const color = isChannels(value.color)
    ? Color.of(value.color, context.space).css()
    : variableCss(value.color, variable, context);
  // Figma keeps the opacity of a composed colour as a percentage; a value up to 1 is read as a fraction.
  const opacity =
    typeof value.opacity === "number"
      ? `${decimal(value.opacity > 1 ? value.opacity : value.opacity * 100)}%`
      : `calc(${variableCss(value.opacity, variable, context)} * 1%)`;

  return `color-mix(in srgb, ${color} ${opacity}, transparent)`;
}

function numberCss(value: number, scopes: readonly string[]): string {
  const unitless = scopes.length > 0 && scopes.every((scope) => UNITLESS_SCOPES.has(scope));
  // An opacity is a percentage in Figma's opacity fields; CSS wants a fraction. A value up to 1 already is one.
  const percent = scopes.some((scope) => scope === "OPACITY" || scope === "COLOR_OPACITY") && value > 1;

  if (unitless) {
    return decimal(percent ? value / 100 : value);
  }

  return value === 0 ? "0" : `${decimal(value)}px`;
}

/** A CSS string in single quotes, its backslashes and quotes escaped. */
function quoted(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function booleanCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  context.notes.add(`${variable.name} is a boolean: CSS has no booleans, it is written as true or false.`);

  return String(value);
}

function easingCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return unknownCss(value, variable, context);
  }

  const bezier =
    "easingFunctionCubicBezier" in value
      ? (value.easingFunctionCubicBezier as Record<string, number> | undefined)
      : undefined;

  if (value.type === "CUSTOM_CUBIC_BEZIER" && bezier !== undefined) {
    return `cubic-bezier(${[bezier.x1, bezier.y1, bezier.x2, bezier.y2].map((point) => decimal(point ?? 0)).join(", ")})`;
  }

  const named = EASINGS.get(String(value.type));

  if (named !== undefined) {
    return named;
  }

  context.notes.add(
    `${variable.name} is a spring easing (${String(value.type)}): CSS has no springs, it is written as ease.`,
  );

  return "ease";
}

function unknownCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  context.notes.add(`${variable.name} has a ${variable.resolvedType} value CSS cannot hold: ${JSON.stringify(value)}.`);

  return `/* ${JSON.stringify(value)} */`;
}
