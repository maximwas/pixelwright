import * as z from "zod";

/** How much a finding matters: an error breaks the build or users; a warning costs a rework; info is tidiness. */
export const LINT_SEVERITIES = ["error", "warning", "info"] as const;

export type LintSeverity = (typeof LINT_SEVERITIES)[number];

/** Every rule design_lint checks, in the order its rules are listed. */
export const LINT_RULE_IDS = [
  "contrast",
  "raw-color",
  "text-style",
  "detached",
  "no-auto-layout",
  "overflow",
  "touch-target",
  "missing-states",
  "raw-number",
  "off-scale",
  "effect-style",
  "overridden",
  "default-name",
  "leftover",
] as const;

export type LintRuleId = (typeof LINT_RULE_IDS)[number];

export const LintFindingSchema = z.object({
  rule: z.enum(LINT_RULE_IDS),
  severity: z.enum(LINT_SEVERITIES),
  id: z.string().describe("The layer (or component set) the finding is about."),
  name: z.string(),
  message: z.string(),
  fix: z.string().exactOptional().describe("How to fix it, naming the tool that does."),
});

export type LintFinding = z.output<typeof LintFindingSchema>;

export const DesignLintSchema = z.object({
  summary: z.string(),
  rules: z
    .array(
      z.object({
        rule: z.enum(LINT_RULE_IDS),
        severity: z.enum(LINT_SEVERITIES),
        count: z.number().int(),
        about: z.string(),
      }),
    )
    .describe("Each rule with findings, and how many: the list below may stop at the limit."),
  findings: z.array(LintFindingSchema).describe("Errors first, then warnings, then info; in layer order within each."),
  more: z.boolean().describe("Findings past the limit were left out: raise limit, narrow within or pick rules."),
  notes: z.array(z.string()),
});

export type DesignLint = z.output<typeof DesignLintSchema>;
