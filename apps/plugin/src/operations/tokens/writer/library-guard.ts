import { type CollectionPlan, isWritableType, type TokenError, variableValueOf } from "@pixelwright/core";
import type { FileTokens } from "./file-tokens.ts";
import { sameSpec } from "./same-values.ts";

/**
 * A library's collection the call names is never copied into the file: each planned variable tokens_read shows
 * differently (or not at all) is an error saying to change it in the library; one it shows the same passes.
 */
export function libraryDifferences(plan: CollectionPlan, file: FileTokens): TokenError[] {
  return plan.variables
    .filter((variable) => {
      const shown = file.shownVariable(plan.name, variable.name);

      return (
        shown === undefined ||
        Object.entries(variable.values).some(([mode, spec]) => {
          const css = shown.values[mode];

          return (
            css === undefined || !sameSpec(variableValueOf(css, isWritableType(shown.type) ? shown.type : null), spec)
          );
        })
      );
    })
    .map((variable) => ({
      kind: "variable",
      collection: plan.name,
      name: variable.name,
      message: `${plan.name} comes from a library: change ${variable.name} there.`,
    }));
}
