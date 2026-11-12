import { numberOf, tokenOf } from "../../css-mapping/values/css-values.ts";
import { tokenName } from "../../kernel/names.ts";
import { scopedUnit } from "../scopes.ts";
import type { CollectionPlan, VariablePlan } from "./types.ts";

/** A planned variable, and whether its numbers were all written without a unit. */
export interface VariableDraft {
  readonly plan: VariablePlan;
  readonly plain: boolean;
}

/** A planned collection before its variables are marked. */
export interface CollectionDraft extends Omit<CollectionPlan, "variables"> {
  readonly drafts: readonly VariableDraft[];
}

/** What tokens_read could only write as a comment (an alias it could not follow): left as it is. */
export const COMMENT = /^\/\*[\s\S]*\*\/$/;

/** Whether every value but aliases and comments is a number written without a unit, not all of them 0. */
export function plainNumbers(values: readonly string[]): boolean {
  const numbers = values.map((css) => css.trim()).filter((css) => !COMMENT.test(css) && tokenOf(css) === null);

  return (
    numbers.length > 0 && numbers.every((css) => numberOf(css) !== null) && numbers.some((css) => Number(css) !== 0)
  );
}

/**
 * The collections' plans, a variable marked unitless when its plain numbers will read back in px: its scopes (if any)
 * say nothing of its unit, and no variable of the call that points at it is scoped as a plain number or an opacity.
 */
export function markedUnitless(collections: readonly CollectionDraft[]): CollectionPlan[] {
  const kept = new Set(collections.flatMap(({ drafts }) => drafts.flatMap(({ plan }) => unitlessTargets(plan))));

  return collections.map(({ drafts, ...collection }) => ({
    ...collection,
    variables: drafts.map(({ plan, plain }) =>
      plain &&
      plan.type === "FLOAT" &&
      (plan.scopes === undefined || scopedUnit(plan.scopes) === null) &&
      !kept.has(plan.token ?? tokenName(plan.name))
        ? {
            ...plan,
            unitless: true,
          }
        : plan,
    ),
  }));
}

/** The tokens a variable scoped as a plain number or an opacity points at: they take its unit. */
function unitlessTargets(plan: VariablePlan): string[] {
  const unit = plan.scopes === undefined ? null : scopedUnit(plan.scopes);

  if (unit === null || unit === "px") {
    return [];
  }

  return Object.values(plan.values).flatMap((value) => (value.kind === "alias" ? [value.token] : []));
}
