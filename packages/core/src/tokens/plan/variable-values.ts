import { lengthOf, numberOf, tokenOf } from "../../css-mapping/values/css-values.ts";
import { Color } from "../../kernel/color/color.ts";
import type { VariableValueSpec, WritableVariableType } from "./types.ts";

/** Reads one mode's CSS value as a value of one variable type; null when it is not one. */
type ValueReader = (css: string) => VariableValueSpec | null;

/** A reader per type tokens_apply writes, each reading what tokens_read writes for that type. */
const VARIABLE_READERS: Readonly<Record<WritableVariableType, ValueReader>> = {
  COLOR: colorValue,
  FLOAT: numberValue,
  STRING: stringValue,
  BOOLEAN: booleanValue,
};

/** The order a value with no type yet is tried in: booleans and numbers before what a colour reader might take. */
const GUESS_ORDER: readonly WritableVariableType[] = ["BOOLEAN", "FLOAT", "STRING", "COLOR"];

/** The type each kind of value gives a variable that was given none; an alias gives none. */
const TYPE_OF_KIND: Readonly<Record<VariableValueSpec["kind"], WritableVariableType | null>> = {
  color: "COLOR",
  number: "FLOAT",
  string: "STRING",
  boolean: "BOOLEAN",
  alias: null,
};

/** Whether tokens_apply writes variables of this type. */
export function isWritableType(type: string): type is WritableVariableType {
  return Object.hasOwn(VARIABLE_READERS, type);
}

/** A mode's CSS value as the type takes it, `var(--token)` as an alias; with no type yet, whatever it reads as. */
export function variableValueOf(css: string, type: WritableVariableType | null): VariableValueSpec | null {
  const value = css.trim();
  const token = tokenOf(value);

  if (token !== null) {
    return {
      kind: "alias",
      token: token.token,
    };
  }

  if (type !== null) {
    return VARIABLE_READERS[type](value);
  }

  for (const guess of GUESS_ORDER) {
    const read = VARIABLE_READERS[guess](value);

    if (read !== null) {
      return read;
    }
  }

  return null;
}

/** The type a value gives a variable that was given none. */
export function variableTypeOf(value: VariableValueSpec): WritableVariableType | null {
  return TYPE_OF_KIND[value.kind];
}

/** A colour, or a colour mixed with transparent at a percentage (how tokens_read writes a colour with opacity). */
function colorValue(value: string): VariableValueSpec | null {
  const mixed = /^color-mix\(\s*in\s+(?:srgb|display-p3)\s*,\s*(.+?)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/s.exec(
    value,
  );
  const color = Color.parse(mixed?.[1] ?? value);

  if (color === null) {
    return null;
  }

  return {
    kind: "color",
    color: (mixed?.[2] === undefined ? color : color.faded(Number(mixed[2]) / 100)).value(),
  };
}

/** A length in px or a plain number. */
function numberValue(value: string): VariableValueSpec | null {
  const length = lengthOf(value);
  const number = typeof length === "number" ? length : numberOf(value);

  return number === null
    ? null
    : {
        kind: "number",
        value: number,
      };
}

/** A quoted string, its backslash escapes undone. */
function stringValue(value: string): VariableValueSpec | null {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);

  return quoted?.[2] === undefined
    ? null
    : {
        kind: "string",
        value: quoted[2].replace(/\\(.)/g, "$1"),
      };
}

function booleanValue(value: string): VariableValueSpec | null {
  return value === "true" || value === "false"
    ? {
        kind: "boolean",
        value: value === "true",
      }
    : null;
}
