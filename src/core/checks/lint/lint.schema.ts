import * as zod from "zod/mini";
import { LINT_FIELD, LINT_RULE, LINT_SEVERITY } from "@/core/checks/lint/lint.constants.ts";

/** A finding of a rule about a layer: why, and how to fix it. */
const LintFindingSchema = zod.object({
  rule: zod.enum(LINT_RULE),
  severity: zod.enum(LINT_SEVERITY),
  id: zod.string().check(zod.describe(LINT_FIELD.id)),
  name: zod.string(),
  message: zod.string(),
  fix: zod.exactOptional(zod.string()).check(zod.describe(LINT_FIELD.fix)),
});

/** design_lint's answer (K-031): the summary, the rules with findings, the findings errors first, and the notes. */
export const DesignLintSchema = zod.object({
  summary: zod.string(),
  rules: zod
    .array(
      zod.object({
        rule: zod.enum(LINT_RULE),
        severity: zod.enum(LINT_SEVERITY),
        count: zod.int(),
        about: zod.string(),
      }),
    )
    .check(zod.describe(LINT_FIELD.rules)),
  findings: zod.array(LintFindingSchema).check(zod.describe(LINT_FIELD.findings)),
  more: zod.boolean().check(zod.describe(LINT_FIELD.more)),
  notes: zod.array(zod.string()),
});

export type LintFinding = zod.output<typeof LintFindingSchema>;

export type DesignLintOutput = zod.output<typeof DesignLintSchema>;

export type LintRuleId = (typeof LINT_RULE)[keyof typeof LINT_RULE];

export type LintSeverity = (typeof LINT_SEVERITY)[keyof typeof LINT_SEVERITY];
