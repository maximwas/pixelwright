import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_TEXT } from "@/core/kernel/names/names.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";
import type { TokenVariable } from "@/core/tokens/model/model.schema.ts";
import { PLAN_PATTERN, PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type { VariableInput } from "@/core/tokens/plan/plan.schema.ts";
import type { Fail, UnlinkedEntry } from "@/core/tokens/plan/plan.types.ts";
import { VARIABLE_VALUES } from "@/core/tokens/plan/variable-values.ts";
import { SCOPE_RULES } from "@/core/tokens/scopes/scope-rules.ts";
import { PLAN_VALUE } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { PlanValue, VariablePlan, WritableType } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/** The values to write: each changed mode's, the type they give, and the CSS of those that are no alias. */
interface Values {
  readonly type: WritableType | null;
  readonly values: Record<string, PlanValue>;
  readonly css: string[];
}

type Changes = Pick<VariablePlan, "description" | "scopes" | "codeSyntax">;

/**
 * One variable of the call set against the file's of its name (K-019, K-021, K-024, FX-051): only what differs from
 * what the file holds, as tokens_read writes it (a value written otherwise that reads the same is held), or why it
 * cannot be written, through fail. A value tokens_read could only write as a comment is left as it is, and a held
 * variable of a type tokens_apply cannot write passes while nothing of its values changes: so tokens_read's own JSON
 * plans nothing.
 */
@injectable()
export class VariablePlans {
  readonly #values;
  readonly #scopes;
  readonly #names;

  constructor(
    values = inject(VARIABLE_VALUES),
    scopes = inject(SCOPE_RULES),
    names = inject(TOKEN_NAMES),
  ) {
    this.#values = values;
    this.#scopes = scopes;
    this.#names = names;
  }

  /** What to write of the variable; null when nothing is, or it cannot be. */
  plan(
    variable: VariableInput,
    held: TokenVariable | undefined,
    fail: Fail,
  ): UnlinkedEntry | null {
    if (PLAN_PATTERN.refusedName.test(variable.name)) {
      fail(PLAN_TEXT.refusedName(variable.name));

      return null;
    }

    // Figma's types are upper case; "color" means the same.
    const given = variable.type?.toUpperCase();

    if (held !== undefined && given !== undefined && given !== held.type) {
      fail(PLAN_TEXT.typeChange(held.type));

      return null;
    }

    const values = this.#changedValues(variable, held, given ?? held?.type ?? null, fail);
    const naming = values === null ? null : this.#naming(variable, held, fail);
    const scopes = naming === null ? null : this.#scopesChange(variable, held, values?.type ?? null, fail);

    if (values === null || naming === null || scopes === null) {
      return null;
    }

    const description =
      variable.description === undefined || variable.description === (held?.description ?? "")
        ? {}
        : { description: variable.description };
    const changes: Changes = { ...description, ...scopes, ...naming.change };

    if (held !== undefined && Object.keys(values.values).length === 0 && Object.keys(changes).length === 0) {
      return null;
    }

    return {
      plan: {
        name: variable.name,
        ...(held === undefined ? {} : { id: held.id }),
        type: values.type,
        values: values.values,
        ...changes,
      },
      token: naming.token,
      css: values.css,
    };
  }

  /** The modes whose CSS differs from what the file holds, read by the variable's type; null when one cannot be. */
  #changedValues(
    variable: VariableInput,
    held: TokenVariable | undefined,
    type: string | null,
    fail: Fail,
  ): Values | null {
    const changed = Object.entries(variable.values)
      .map(([mode, css]) => [mode, css.trim()] as const)
      .filter(([mode, css]) => !PLAN_PATTERN.comment.test(css) && held?.values[mode] !== css);

    if (type !== null && !this.#values.writable(type)) {
      // shortcut: a held EASING or TIMING variable keeps its scopes, code syntax and description too, until D-28 writes them.
      if (held === undefined || changed.length > 0) {
        fail(PLAN_TEXT.notWritable(type));
      }

      return null;
    }

    return this.#read(changed, held, type, fail);
  }

  /** Each changed mode's CSS as the type takes it (a type from the first value that gives one); null when one fails. */
  #read(
    changed: readonly (readonly [string, string])[],
    held: TokenVariable | undefined,
    type: WritableType | null,
    fail: Fail,
  ): Values | null {
    let known = type;
    let failed = false;
    const read: Values = { type, values: {}, css: [] };

    for (const [mode, css] of changed) {
      const value = this.#values.value(css, known);

      if (value === null) {
        fail(known === null ? PLAN_TEXT.unreadable(css) : PLAN_TEXT.notOfType(css, known), mode);
        failed = true;
      } else if (!this.#held(value, held?.values[mode], known ?? this.#values.typeOf(value))) {
        known ??= this.#values.typeOf(value);
        read.values[mode] = value;
        read.css.push(...(value.kind === PLAN_VALUE.alias ? [] : [css]));
      }
    }

    return failed ? null : { ...read, type: known };
  }

  /** Whether the file's CSS of the mode reads as the same value. */
  #held(
    value: PlanValue,
    css: string | undefined,
    type: WritableType | null,
  ): boolean {
    const now = css === undefined ? null : this.#values.value(css, type);

    return now !== null && JSON.stringify(now) === JSON.stringify(value);
  }

  /**
   * The variable's CSS name and the code syntax to write: WEB is its CSS name, so a token that disagrees with it is the
   * variable's error; a token other than its name's own, given without WEB, becomes WEB (K-021).
   */
  #naming(
    variable: VariableInput,
    held: TokenVariable | undefined,
    fail: Fail,
  ): { token: string; change: Changes } | null {
    const web = variable.codeSyntax?.WEB;
    const named =
      web === undefined || web === ""
        ? undefined
        : this.#names.variable({ name: variable.name, codeSyntax: { WEB: web } });

    if (web !== undefined && named !== undefined && variable.token !== undefined && variable.token !== named) {
      fail(PLAN_TEXT.twoNames(variable.token, web, named));

      return null;
    }

    const own = this.#names.token(variable.name);
    const token = variable.token;
    const renamed = web === undefined && token !== undefined && token !== own && token !== held?.token;
    const wanted = { ...variable.codeSyntax, ...(renamed ? { WEB: TOKEN_TEXT.reference(token) } : {}) };
    const now: Readonly<Record<string, string | undefined>> = { ...held?.codeSyntax };
    const differs = Object.entries(wanted).filter(([platform, value]) => (now[platform] ?? "") !== value);

    return {
      token: named ?? token ?? held?.token ?? own,
      change: differs.length === 0 ? {} : { codeSyntax: Object.fromEntries(differs) },
    };
  }

  /**
   * The scopes to write, deduplicated, when given and other than the file's; null when Figma would refuse them. A new
   * variable of only aliases has no type yet: AliasLinks checks its scopes once its target's type is the variable's.
   */
  #scopesChange(
    variable: VariableInput,
    held: TokenVariable | undefined,
    type: string | null,
    fail: Fail,
  ): Changes | null {
    if (variable.scopes === undefined) {
      return {};
    }

    const scopes = [...new Set(variable.scopes)];
    const error = type === null ? null : this.#scopes.error(type, scopes);

    if (error !== null) {
      fail(error);

      return null;
    }

    const now = held?.scopes ?? (held === undefined ? undefined : [VARIABLE_VALUE.allScopes]);

    return now !== undefined && this.#scopes.same(scopes, now) ? {} : { scopes };
  }
}

export const VARIABLE_PLANS = new InjectionToken<VariablePlans>("VariablePlans");
