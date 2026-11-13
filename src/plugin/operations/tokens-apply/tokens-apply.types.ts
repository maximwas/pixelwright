import type {
  CollectionPlan,
  StylePlans,
  TokenError,
  TokenItem,
  VariablePlan,
  VariableTarget,
} from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

export type PaintStylePlan = StylePlans["paint"][number];

export type TextStylePlan = StylePlans["text"][number];

export type EffectStylePlan = StylePlans["effect"][number];

/** The colour variables the styles name, by token. */
export type Targets = Readonly<Record<string, VariableTarget>>;

/** What a call answers: what it made and changed (or would), what it could not write, what it could not know. */
interface TokensAnswer {
  readonly created: TokenItem[];
  readonly updated: TokenItem[];
  readonly errors: TokenError[];
  readonly notes: string[];
}

/** One call: whether it writes, its answer, the variables it reaches, and whether the file changed. */
export interface TokenRun {
  readonly dryRun: boolean;
  readonly answer: TokensAnswer;
  /** The file's own variables by id, listed once: found without a by-id lookup (P-070). */
  readonly local: Map<string, Variable>;
  /** The variables the call made, by token: an alias or a style's colour with no id and no key points at one. */
  readonly made: Map<string, Variable>;
  /** Set once the file changes: the call closes one undo step. */
  wrote: boolean;
}

/** A planned collection being written: Figma's (none on a dry run), its modes' ids by name, the modes refused. */
export interface Target {
  readonly plan: CollectionPlan;
  readonly collection: VariableCollection | null;
  readonly modes: Map<string, string>;
  readonly failed: Set<string>;
}

/** A planned variable and the Figma one it is written to (none on a dry run). */
export interface WrittenVariable {
  readonly target: Target;
  readonly plan: VariablePlan;
  readonly variable: Variable | null;
}
