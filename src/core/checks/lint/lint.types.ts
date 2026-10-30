import type { LintFinding, LintRuleId, LintSeverity } from "@/core/checks/lint/lint.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer as a rule sees it: the layer, its parent, the read it is in, and what holds it (K-032). */
export interface LintLayer {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
  readonly model: ReadModel;
  /** The layer comes from a component through an instance: its look is the component's. */
  readonly inInstance: boolean;
  /** The layer is part of a main component (or a set): its hidden layers are property-driven. */
  readonly inComponent: boolean;
}

/** What a rule says of a layer; the walk adds the rule and its severity. */
export type RuleFinding = Omit<LintFinding, "rule" | "severity">;

/** A rule's findings on one layer. */
export type RuleCheck = (layer: LintLayer) => readonly RuleFinding[];

/** A set of rules (TokenRules, LayoutRules): each rule it checks, by id. */
export interface RuleSet {
  checks(): Partial<Record<LintRuleId, RuleCheck>>;
}

/** A rule the walk runs: its row of the registry and its check. */
export interface LintRule {
  readonly id: LintRuleId;
  readonly severity: LintSeverity;
  readonly about: string;
  readonly hidden: boolean;
  readonly check: RuleCheck;
}
