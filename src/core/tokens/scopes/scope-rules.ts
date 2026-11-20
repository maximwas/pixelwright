import { InjectionToken, injectable } from "@needle-di/core";
import { VARIABLE_TYPE, VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";
import { ALL_FILLS, FILL_SCOPES, SCOPES_TEXT, TYPE_SCOPES } from "@/core/tokens/scopes/scopes.constants.ts";

/**
 * The scopes Figma lets a variable take (K-024, FX-050): those of its type, ALL_SCOPES alone, ALL_FILLS without the
 * fills it covers, and never none on a BOOLEAN. Checked before anything is written, dry runs too; Figma keeps scopes
 * in its own order, so two lists are the same when they hold the same scopes.
 */
@injectable()
export class ScopeRules {
  /** Why Figma would refuse these scopes on a variable of this type; null when it takes them. */
  error(type: string, scopes: readonly string[]): string | null {
    const allowed = TYPE_SCOPES[type];

    if (allowed === undefined) {
      return null;
    }

    const refused = scopes.filter((scope) => !allowed.includes(scope));

    if (refused.length > 0) {
      return SCOPES_TEXT.refused(type, refused, allowed);
    }

    if (scopes.includes(VARIABLE_VALUE.allScopes) && scopes.length > 1) {
      return SCOPES_TEXT.alone;
    }

    if (scopes.includes(ALL_FILLS) && scopes.some((scope) => FILL_SCOPES.includes(scope))) {
      return SCOPES_TEXT.fills;
    }

    return type === VARIABLE_TYPE.boolean && scopes.length === 0 ? SCOPES_TEXT.boolean : null;
  }

  same(first: readonly string[], second: readonly string[]): boolean {
    return first.length === second.length && first.every((scope) => second.includes(scope));
  }
}

export const SCOPE_RULES = new InjectionToken<ScopeRules>("ScopeRules");
