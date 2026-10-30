import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LINT_SEVERITY, LINT_SUMMARY, SEVERITY_RANK } from "@/core/checks/lint/lint.constants.ts";
import type { DesignLintOutput, LintFinding, LintRuleId, LintSeverity } from "@/core/checks/lint/lint.schema.ts";
import { LINT_REGISTRY } from "@/core/checks/lint/lint-registry.ts";
import { LINT_WALK } from "@/core/checks/lint/lint-walk.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** What a lint checks: each root's read, and how many roots could not be read (the summary says so, K-033). */
export interface LintInput {
  readonly reads: readonly ReadModel[];
  readonly unread: number;
}

/** Which rules a lint runs (every one when none are named), how many findings it lists, and its scope's name. */
export interface LintOptions {
  readonly rules?: readonly LintRuleId[] | undefined;
  readonly limit: number;
  readonly scope: string;
}

/**
 * The checks domain's facade: design_lint over read models (K-031). Each finding names its layer, why and how to fix
 * it; errors first, layer order within a severity; each rule listed at its most severe finding (B-016); layers that
 * could not be read open the summary, so they never pass for clean ones (K-033, B-008).
 */
@injectable()
export class DesignLint {
  readonly #registry;
  readonly #walk;

  constructor(registry = inject(LINT_REGISTRY), walk = inject(LINT_WALK)) {
    this.#registry = registry;
    this.#walk = walk;
  }

  lint({ reads, unread }: LintInput, { rules: asked, limit, scope }: LintOptions): DesignLintOutput {
    const rules = this.#registry.rules(asked);
    const shown = reads
      .flatMap((model) => this.#walk.findings(model, rules))
      .sort((first, second) => SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity]);
    const unchecked = this.#registry.unchecked(asked);

    return {
      summary: this.#summary(
        shown,
        limit,
        unread === 0 ? scope : null,
        LINT_SUMMARY.notChecked(unread, reads.length + unread),
      ),
      rules: rules.flatMap((rule) => {
        const own = shown.filter((finding) => finding.rule === rule.id);
        const [worst] = own;

        return worst === undefined
          ? []
          : [{ rule: rule.id, severity: worst.severity, count: own.length, about: rule.about }];
      }),
      findings: shown.slice(0, limit),
      more: shown.length > limit,
      notes: unchecked.length === 0 ? [] : [LINT_SUMMARY.unchecked(unchecked)],
    };
  }

  /** The findings by severity; `scope` null when layers went unread: the summary opens with them, then "the rest". */
  #summary(
    findings: readonly LintFinding[],
    limit: number,
    scope: string | null,
    unread: string,
  ): string {
    const prefix = scope === null ? unread : "";
    const where = scope ?? LINT_SUMMARY.rest;
    const count = (severity: LintSeverity) => findings.filter((finding) => finding.severity === severity).length;

    return LINT_SUMMARY.line(
      prefix,
      findings.length === 0
        ? LINT_SUMMARY.none(where)
        : LINT_SUMMARY.counts(
          findings.length,
          where,
          [count(LINT_SEVERITY.error), count(LINT_SEVERITY.warning), count(LINT_SEVERITY.info)],
          findings.length > limit ? limit : null,
        ),
    );
  }
}

export const DESIGN_LINT = new InjectionToken<DesignLint>("DesignLint");
