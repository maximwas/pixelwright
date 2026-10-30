import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYOUT_RULES } from "@/core/checks/lint/layout-rules.ts";
import { LINT_RULES } from "@/core/checks/lint/lint.constants.ts";
import type { LintRuleId } from "@/core/checks/lint/lint.schema.ts";
import type { LintRule, RuleCheck } from "@/core/checks/lint/lint.types.ts";
import { TOKEN_RULES } from "@/core/checks/lint/token-rules.ts";

/** The rules design_lint runs (Registry, K-031): LINT_RULES' rows in their order, each with the check its set gives. */
@injectable()
export class LintRegistry {
  readonly #tokens;
  readonly #layout;

  constructor(tokens = inject(TOKEN_RULES), layout = inject(LAYOUT_RULES)) {
    this.#tokens = tokens;
    this.#layout = layout;
  }

  /** The rules asked (every rule when none are) that this build checks, in LINT_RULES' order. */
  rules(asked: readonly LintRuleId[] | undefined): LintRule[] {
    const checks = this.#checks();

    return LINT_RULES.flatMap((row) => {
      const check = checks[row.id];

      return check === undefined || (asked !== undefined && !asked.includes(row.id)) ? [] : [{ ...row, check }];
    });
  }

  /** The rules asked that this build does not check yet: a note says so, so they never pass for clean. */
  unchecked(asked: readonly LintRuleId[] | undefined): LintRuleId[] {
    const checks = this.#checks();

    return (asked ?? []).filter((id) => checks[id] === undefined);
  }

  #checks(): Partial<Record<LintRuleId, RuleCheck>> {
    return { ...this.#tokens.checks(), ...this.#layout.checks() };
  }
}

export const LINT_REGISTRY = new InjectionToken<LintRegistry>("LintRegistry");
