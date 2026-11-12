import type { RawTokens, VariablePlan } from "@pixelwright/core";
import { errorMessage } from "../../../utils/error-message.ts";
import type { Target } from "./collections.ts";
import type { TokenRun } from "./token-run.ts";

/** A planned variable and the Figma one it is written to (none for a new one on a dry run). */
export interface WrittenVariable {
  readonly target: Target;
  readonly plan: VariablePlan;
  readonly variable: Variable | null;
  /** The variable as the file holds it, for one that exists. */
  readonly held: RawTokens["variables"][number] | null;
  readonly type: string;
}

/** Runs a write on the variable, unless dry; whether it changes. What Figma refuses is the variable's error. */
export async function attempt(
  run: TokenRun,
  item: WrittenVariable,
  write: (variable: Variable) => Promise<void> | void,
  mode?: string,
): Promise<boolean> {
  try {
    if (!run.dryRun && item.variable !== null) {
      await write(item.variable);
      run.wrote();
    }

    return true;
  } catch (error) {
    failVariable(run, item, errorMessage(error), mode);

    return false;
  }
}

/** The variable's error, in one of its modes or as a whole. */
export function failVariable(run: TokenRun, { target, plan }: WrittenVariable, message: string, mode?: string): void {
  run.failed({
    kind: "variable",
    collection: target.plan.name,
    name: plan.name,
    ...(mode === undefined ? {} : { mode }),
    message,
  });
}
