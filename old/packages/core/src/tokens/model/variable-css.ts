import { decimalPx } from "../../css-mapping/values/format.ts";
import { Color, isChannels } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { easingCss as kernelEasingCss } from "../../kernel/easing.ts";
import { decimal } from "../../kernel/numbers.ts";
import { aliasOf } from "../aliases.ts";
import type { Notes } from "../notes.ts";
import type { RawVariable } from "../raw-tokens.ts";
import { type NumberUnit, scopedUnit } from "../scopes.ts";

/**
 * What writing a variable's values needs: the CSS names aliases point at, the file's colour space, the notes, and each
 * number variable's unit when the aliases between them were followed (else a number's own scopes give it).
 */
export interface VariableCssContext {
  readonly names: ReadonlyMap<string, string>;
  readonly space: ColorSpace;
  readonly notes: Notes;
  readonly units?: ReadonlyMap<string, NumberUnit>;
}

/** Writes one mode's value of a variable of one type as CSS. */
type ValueCss = (value: unknown, variable: RawVariable, context: VariableCssContext) => string;

/** A writer per variable type; a type without one is written as a comment, with a note. */
const VALUE_CSS: ReadonlyMap<string, ValueCss> = new Map<string, ValueCss>([
  ["COLOR", colorCss],
  [
    "FLOAT",
    (value, variable, context) =>
      typeof value === "number"
        ? numberCss(value, context.units?.get(variable.id) ?? scopedUnit(variable.scopes) ?? "px")
        : unknownCss(value, variable, context),
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

function numberCss(value: number, unit: NumberUnit): string {
  if (unit === "px") {
    return decimalPx(value);
  }

  // An opacity is a percentage in Figma's opacity fields; CSS wants a fraction. A value up to 1 already is one.
  return decimal(unit === "opacity" && value > 1 ? value / 100 : value);
}

/** A CSS string in single quotes, its backslashes and quotes escaped. */
function quoted(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function booleanCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  context.notes.add(`${variable.name} is a boolean: CSS has no booleans, it is written as true or false.`);

  return String(value);
}

function unknownCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  context.notes.add(`${variable.name} has a ${variable.resolvedType} value CSS cannot hold: ${JSON.stringify(value)}.`);

  return `/* ${JSON.stringify(value)} */`;
}

/** An easing as valid CSS (a spring as linear()); a value no easing Figma has is written as a comment, with a note. */
function easingCss(value: unknown, variable: RawVariable, context: VariableCssContext): string {
  const css =
    typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
      ? kernelEasingCss(value as { type: string })
      : null;

  return css ?? unknownCss(value, variable, context);
}
