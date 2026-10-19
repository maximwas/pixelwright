import { tokenName, variableTokenName } from "../../kernel/names.ts";
import { COMMENT, type CollectionDraft, markedUnitless, plainNumbers, type VariableDraft } from "./plain-numbers.ts";
import type { TokensApplyInput } from "./schemas.ts";
import { type StyleKind, type StyleValue, styleValueOf } from "./style-values.ts";
import type {
  EffectStylePlan,
  PaintStylePlan,
  TextStylePlan,
  TokenError,
  TokensPlan,
  VariablePlan,
  VariableValueSpec,
  WritableVariableType,
} from "./types.ts";
import { isWritableType, variableTypeOf, variableValueOf } from "./variable-values.ts";

type InputCollection = TokensApplyInput["collections"][number];
type InputVariable = InputCollection["variables"][number];

/** The styles' plans as they are read. */
interface StylesDraft {
  paint: PaintStylePlan[];
  text: TextStylePlan[];
  effect: EffectStylePlan[];
}

/** The style kinds in the order their errors are listed. */
const STYLE_KINDS: readonly StyleKind[] = ["paint", "text", "effect"];

/**
 * tokens_apply's input in Figma's terms: each mode's CSS value read back as tokens_read writes it (a colour, px or a
 * plain number, a quoted string, true/false, var(--token) for an alias), a variable's type from its first value when
 * none is given. A value its type cannot take, or a type tokens_apply cannot write, is that variable's error; the rest
 * goes on.
 */
export function tokensPlan(input: TokensApplyInput): { plan: TokensPlan; errors: TokenError[] } {
  const errors: TokenError[] = [];
  const collections = markedUnitless(input.collections.map((collection) => collectionDraft(collection, errors)));
  const styles = stylesPlan(input.styles, errors);

  return {
    plan: {
      collections,
      styles,
    },
    errors,
  };
}

function collectionDraft(collection: InputCollection, errors: TokenError[]): CollectionDraft {
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
    drafts: collection.variables.flatMap((variable) => variableDraft(variable, fail) ?? []),
  };
}

/** A variable's plan, or null when any of its values cannot be written (each such value is its own error). */
function variableDraft(
  variable: InputVariable,
  fail: (variable: InputVariable, message: string, mode?: string) => void,
): VariableDraft | null {
  if (variable.type !== undefined && !isWritableType(variable.type)) {
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

  const plan = failed ? null : planOf(variable, type, values);

  if (typeof plan === "string") {
    fail(variable, plan);
  }

  return plan === null || typeof plan === "string"
    ? null
    : {
        plan,
        plain: plainNumbers(Object.values(variable.values)),
      };
}

/** The variable's plan, or why its CSS name cannot be told. */
function planOf(
  variable: InputVariable,
  type: WritableVariableType | null,
  values: Record<string, VariableValueSpec>,
): VariablePlan | string {
  const token = cssNameOf(variable);

  if (typeof token !== "string") {
    return token.error;
  }

  const codeSyntax = Object.keys(variable.codeSyntax ?? {}).length === 0 ? undefined : variable.codeSyntax;

  return {
    name: variable.name,
    type,
    values,
    ...(variable.description === undefined ? {} : { description: variable.description }),
    ...(token === tokenName(variable.name) ? {} : { token }),
    ...(variable.scopes === undefined ? {} : { scopes: [...new Set(variable.scopes)] }),
    ...(codeSyntax === undefined ? {} : { codeSyntax }),
  };
}

/** The variable's CSS name: its WEB code syntax's when the call gives one, else its token's, else its name's. */
function cssNameOf(variable: InputVariable): string | { error: string } {
  const web = variable.codeSyntax?.WEB;

  if (web === undefined) {
    return variable.token ?? tokenName(variable.name);
  }

  const named = variableTokenName({
    name: variable.name,
    codeSyntax: { WEB: web },
  });

  return variable.token === undefined || variable.token === named
    ? named
    : {
        error: `token ${variable.token} and codeSyntax.WEB "${web}" (${named}) name two CSS properties: give one of them.`,
      };
}

function unreadable(css: string, type: WritableVariableType | null): string {
  return type === null
    ? `${css} is not a colour, a length, a number, a quoted string, true/false or var(--token).`
    : `${css} is not a ${type} value.`;
}

/** Each style's value read; one that cannot be is its error. */
function stylesPlan(styles: TokensApplyInput["styles"], errors: TokenError[]): TokensPlan["styles"] {
  const plan: StylesDraft = {
    paint: [],
    text: [],
    effect: [],
  };

  for (const kind of STYLE_KINDS) {
    for (const style of styles[kind]) {
      const read = styleValueOf(kind, style.value, "also" in style ? style.also : undefined);

      if ("error" in read) {
        errors.push({
          kind,
          name: style.name,
          message: read.error,
        });
      } else {
        addStyle(plan, style.name, read);
      }
    }
  }

  return plan;
}

function addStyle(plan: StylesDraft, name: string, read: Exclude<StyleValue, { error: string }>): void {
  if ("paints" in read) {
    plan.paint.push({
      name,
      ...read,
    });
  } else if ("font" in read) {
    plan.text.push({
      name,
      ...read,
    });
  } else {
    plan.effect.push({
      name,
      ...read,
    });
  }
}

/** The modes the values name, in the order they first appear. */
function modesOf(variables: readonly InputVariable[]): string[] {
  return [...new Set(variables.flatMap((variable) => Object.keys(variable.values)))];
}
