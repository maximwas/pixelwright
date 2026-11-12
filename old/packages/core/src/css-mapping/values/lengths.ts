import { variableTokenName } from "../../kernel/names.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { px } from "./format.ts";
import { boundVariable } from "./paints.ts";

/** A length, or the token of the variable bound to it. */
export function lengthCss(node: SnapshotNode, key: string, value: number, context: CssContext): string {
  const variable = boundVariable(node.boundVariables?.[key], context);

  if (variable === null) {
    return px(value);
  }

  const name = variableTokenName(variable);

  if (typeof variable.value === "number") {
    context.tokens.set(name, px(variable.value));
  }

  return `var(${name})`;
}
