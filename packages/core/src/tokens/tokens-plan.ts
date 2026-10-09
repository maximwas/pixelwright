import type * as z from "zod";
import { changeOf } from "../apply/css-to-figma.ts";
import { colorOf, lengthOf, numberOf, tokenOf } from "../apply/css-values.ts";
import { tokenName } from "../css/tokens.ts";
import type { TokensApplyInputSchema } from "../schemas/tokens-apply.ts";
import type { FigmaProps } from "../types/apply.ts";
import type {
  CollectionPlan,
  EffectStylePlan,
  PaintStylePlan,
  TextStylePlan,
  TokenError,
  TokenKind,
  TokensPlan,
  VariablePlan,
  VariableValueSpec,
  WritableVariableType,
} from "../types/tokens-apply.ts";

type TokensApplyInput = z.output<typeof TokensApplyInputSchema>;

const WRITABLE: ReadonlySet<string> = new Set(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);

/**
 * tokens_apply's input in Figma's terms: each mode's CSS value read back as tokens_read writes it (a colour, px or a
 * plain number, a quoted string, true/false, var(--token) for an alias), a variable's type from its first value when
 * none is given. A value its type cannot take, or a type tokens_apply cannot write, is that variable's error; the rest
 * goes on.
 */
export function tokensPlan(input: TokensApplyInput): { plan: TokensPlan; errors: TokenError[] } {
  const errors: TokenError[] = [];
  const collections: CollectionPlan[] = input.collections.map((collection) => {
    const variables: VariablePlan[] = [];

    for (const variable of collection.variables) {
      const fail = (message: string, mode?: string) =>
        errors.push({
          kind: "variable",
          collection: collection.name,
          name: variable.name,
          ...(mode === undefined ? {} : { mode }),
          message,
        });

      if (variable.type !== undefined && !WRITABLE.has(variable.type)) {
        fail(`${variable.type} variables cannot be written yet: COLOR, FLOAT, STRING and BOOLEAN can.`);
        continue;
      }

      const given = variable.type as WritableVariableType | undefined;
      const values: Record<string, VariableValueSpec> = {};
      let type: WritableVariableType | null = given ?? null;
      let failed = false;

      for (const [mode, css] of Object.entries(variable.values)) {
        // What tokens_read could only write as a comment (an alias it could not follow) stays as it is.
        if (/^\/\*[\s\S]*\*\/$/.test(css.trim())) {
          continue;
        }

        const value = readValue(css, type);

        if (value === null) {
          fail(
            type === null
              ? `${css} is not a colour, a length, a number, a quoted string, true/false or var(--token).`
              : `${css} is not a ${type} value.`,
            mode,
          );
          failed = true;
          continue;
        }

        type ??= typeOf(value);
        values[mode] = value;
      }

      if (!failed) {
        variables.push({
          name: variable.name,
          type,
          values,
          ...(variable.description === undefined ? {} : { description: variable.description }),
          ...(variable.token === undefined || variable.token === tokenName(variable.name)
            ? {}
            : { token: variable.token }),
        });
      }
    }

    return {
      name: collection.name,
      modes: collection.modes ?? modesOf(collection.variables.map((variable) => variable.values)),
      variables,
    };
  });

  const styles = {
    paint: [] as PaintStylePlan[],
    text: [] as TextStylePlan[],
    effect: [] as EffectStylePlan[],
  };
  const read = (kind: TokenKind, name: string, tag: "Frame" | "Text", attribute: string, value: string) => {
    const { change, errors: refused } = changeOf({
      line: 1,
      column: 1,
      tag,
      id: null,
      ref: "token",
      parent: null,
      index: 0,
      attributes: { [attribute]: value },
    });

    for (const error of refused) {
      errors.push({
        kind,
        name,
        message: error.message,
      });
    }

    return refused.length === 0 ? change.props : null;
  };
  const refuse = (kind: TokenKind, name: string, message: string) =>
    errors.push({
      kind,
      name,
      message,
    });

  for (const { name, value } of input.styles.paint) {
    const paints = read("paint", name, "Frame", "background", value)?.fills;

    if (paints?.some((paint) => paint.kind === "image") ?? false) {
      refuse("paint", name, `${value} is an image: a paint style holds colours and colour variables.`);
    } else if (paints !== undefined && paints.length > 0) {
      styles.paint.push({
        name,
        paints,
      });
    } else if (paints !== undefined) {
      refuse("paint", name, "A paint style holds at least one colour.");
    }
  }

  for (const { name, value } of input.styles.text) {
    const font = read("text", name, "Text", "font", value)?.font;

    if (font !== undefined) {
      styles.text.push({
        name,
        font,
      });
    }
  }

  for (const { name, value } of input.styles.effect) {
    const effects: FigmaProps["effects"] = read("effect", name, "Frame", "box-shadow", value)?.effects;

    if (effects !== undefined && !Array.isArray(effects)) {
      refuse("effect", name, `${value} names another style: an effect style holds its shadows.`);
    } else if (effects !== undefined) {
      styles.effect.push({
        name,
        effects,
      });
    }
  }

  return {
    plan: {
      collections,
      styles,
    },
    errors,
  };
}

/** A mode's CSS value as the type takes it; with no type yet, whatever it reads as. */
function readValue(css: string, type: WritableVariableType | null): VariableValueSpec | null {
  const value = css.trim();
  const token = tokenOf(value);

  if (token !== null) {
    return {
      kind: "alias",
      token: token.token,
    };
  }

  const readers: Record<WritableVariableType, () => VariableValueSpec | null> = {
    COLOR: () => colorValue(value),
    FLOAT: () => {
      const length = lengthOf(value);
      const number = typeof length === "number" ? length : numberOf(value);

      return number === null
        ? null
        : {
            kind: "number",
            value: number,
          };
    },
    STRING: () => {
      const quoted = /^(['"])([\s\S]*)\1$/.exec(value);

      return quoted?.[2] === undefined
        ? null
        : {
            kind: "string",
            value: quoted[2].replace(/\\(.)/g, "$1"),
          };
    },
    BOOLEAN: () =>
      value === "true" || value === "false"
        ? {
            kind: "boolean",
            value: value === "true",
          }
        : null,
  };

  if (type !== null) {
    return readers[type]();
  }

  // Booleans and numbers before colours: a colour reader would not take them, but the order says what wins.
  return readers.BOOLEAN() ?? readers.FLOAT() ?? readers.STRING() ?? readers.COLOR();
}

/** A colour, or a colour mixed with transparent at a percentage (how tokens_read writes a colour with opacity). */
function colorValue(value: string): VariableValueSpec | null {
  const mixed = /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/s.exec(value);
  const color = colorOf(mixed?.[1] ?? value);

  if (color === null) {
    return null;
  }

  return {
    kind: "color",
    color: {
      ...color,
      a: mixed?.[2] === undefined ? color.a : color.a * (Number(mixed[2]) / 100),
    },
  };
}

function typeOf(value: VariableValueSpec): WritableVariableType | null {
  switch (value.kind) {
    case "color":
      return "COLOR";
    case "number":
      return "FLOAT";
    case "string":
      return "STRING";
    case "boolean":
      return "BOOLEAN";
    case "alias":
      return null;
  }
}

/** The modes the values name, in the order they first appear. */
function modesOf(values: readonly Readonly<Record<string, string>>[]): string[] {
  return [...new Set(values.flatMap((byMode) => Object.keys(byMode)))];
}
