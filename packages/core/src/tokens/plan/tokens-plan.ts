import { tokenName } from "../../kernel/names.ts";
import type { TokensApplyInput } from "./schemas.ts";
import { type StyleKind, styleValueOf } from "./style-values.ts";
import type {
  CollectionPlan,
  EffectStylePlan,
  PaintStylePlan,
  TextStylePlan,
  TokenError,
  TokensPlan,
  VariablePlan,
  VariableValueSpec,
  WritableVariableType,
} from "./types.ts";
import { variableTypeOf, variableValueOf } from "./variable-values.ts";

type InputCollection = TokensApplyInput["collections"][number];
type InputVariable = InputCollection["variables"][number];

const WRITABLE: ReadonlySet<string> = new Set<WritableVariableType>(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);

/** The style kinds in the order their errors are listed. */
const STYLE_KINDS: readonly StyleKind[] = ["paint", "text", "effect"];

/** What tokens_read could only write as a comment (an alias it could not follow): left as it is. */
const COMMENT = /^\/\*[\s\S]*\*\/$/;

/**
 * tokens_apply's input in Figma's terms: each mode's CSS value read back as tokens_read writes it (a colour, px or a
 * plain number, a quoted string, true/false, var(--token) for an alias), a variable's type from its first value when
 * none is given. A value its type cannot take, or a type tokens_apply cannot write, is that variable's error; the rest
 * goes on.
 */
export function tokensPlan(input: TokensApplyInput): { plan: TokensPlan; errors: TokenError[] } {
  const errors: TokenError[] = [];
  const collections = input.collections.map((collection) => collectionPlan(collection, errors));
  const styles = stylesPlan(input.styles, errors);

  return {
    plan: {
      collections,
      styles,
    },
    errors,
  };
}

function collectionPlan(collection: InputCollection, errors: TokenError[]): CollectionPlan {
  const fail = (variable: InputVariable, message: string, mode?: string) =>
    errors.push({
      kind: "variable",
      collection: collection.name,
      name: variable.name,
      ...(mode === undefined ? {} : { mode }),
      message,
    });

  return {
    name: collection.name,
    modes: collection.modes ?? modesOf(collection.variables),
    variables: collection.variables.flatMap((variable) => variablePlan(variable, fail) ?? []),
  };
}

/** A variable's plan, or null when any of its values cannot be written (each such value is its own error). */
function variablePlan(
  variable: InputVariable,
  fail: (variable: InputVariable, message: string, mode?: string) => void,
): VariablePlan | null {
  if (variable.type !== undefined && !isWritable(variable.type)) {
    fail(variable, `${variable.type} variables cannot be written yet: COLOR, FLOAT, STRING and BOOLEAN can.`);

    return null;
  }

  let type: WritableVariableType | null = variable.type ?? null;
  const values: Record<string, VariableValueSpec> = {};
  let failed = false;

  for (const [mode, css] of Object.entries(variable.values)) {
    if (COMMENT.test(css.trim())) {
      continue;
    }

    const value = variableValueOf(css, type);

    if (value === null) {
      fail(variable, unreadable(css, type), mode);
      failed = true;
      continue;
    }

    type ??= variableTypeOf(value);
    values[mode] = value;
  }

  return failed ? null : planOf(variable, type, values);
}

function planOf(
  variable: InputVariable,
  type: WritableVariableType | null,
  values: Record<string, VariableValueSpec>,
): VariablePlan {
  return {
    name: variable.name,
    type,
    values,
    ...(variable.description === undefined ? {} : { description: variable.description }),
    ...(variable.token === undefined || variable.token === tokenName(variable.name) ? {} : { token: variable.token }),
  };
}

function isWritable(type: string): type is WritableVariableType {
  return WRITABLE.has(type);
}

function unreadable(css: string, type: WritableVariableType | null): string {
  return type === null
    ? `${css} is not a colour, a length, a number, a quoted string, true/false or var(--token).`
    : `${css} is not a ${type} value.`;
}

/** Each style's value read; one that cannot be is its error. */
function stylesPlan(styles: TokensApplyInput["styles"], errors: TokenError[]): TokensPlan["styles"] {
  const plan: { paint: PaintStylePlan[]; text: TextStylePlan[]; effect: EffectStylePlan[] } = {
    paint: [],
    text: [],
    effect: [],
  };

  for (const kind of STYLE_KINDS) {
    for (const { name, value } of styles[kind]) {
      const read = styleValueOf(kind, value);

      if ("error" in read) {
        errors.push({
          kind,
          name,
          message: read.error,
        });
      } else if ("paints" in read) {
        plan.paint.push({
          name,
          paints: read.paints,
        });
      } else if ("font" in read) {
        plan.text.push({
          name,
          font: read.font,
        });
      } else {
        plan.effect.push({
          name,
          effects: read.effects,
        });
      }
    }
  }

  return plan;
}

/** The modes the values name, in the order they first appear. */
function modesOf(variables: readonly InputVariable[]): string[] {
  return [...new Set(variables.flatMap((variable) => Object.keys(variable.values)))];
}
