import type { FigmaProps, LengthValue } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { refusal } from "../../../figma/capabilities.ts";
import type { WriteScope } from "./write-scope.ts";

/** One step of writing a layer: the properties it takes, and how it writes them. */
export interface Step {
  readonly keys: readonly (keyof FigmaProps)[];
  readonly write: (node: SceneNode, props: FigmaProps, scope: WriteScope) => void | Promise<void>;
}

type StepWrite<N extends SceneNode> = (node: N, props: FigmaProps, scope: WriteScope) => void | Promise<void>;

/** A step's write for the layers a guard lets through; any other layer is refused, naming what it lacks. */
export function guarded<N extends SceneNode>(
  accepts: (node: SceneNode) => node is N,
  what: string,
  write: StepWrite<N>,
): Step["write"] {
  return (node, props, scope) => {
    if (!accepts(node)) {
      throw refusal(node, what);
    }

    return write(node, props, scope);
  };
}

/** The number fields a length writes, each one a variable can bind to. */
export type LengthField = Extract<
  VariableBindableNodeField,
  | "itemSpacing"
  | "counterAxisSpacing"
  | "gridRowGap"
  | "gridColumnGap"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "cornerRadius"
  | "topLeftRadius"
  | "topRightRadius"
  | "bottomRightRadius"
  | "bottomLeftRadius"
  | "minWidth"
  | "maxWidth"
  | "minHeight"
  | "maxHeight"
>;

/** The variable bound to a field, if one is. */
export function boundTo(node: SceneNode, field: VariableBindableNodeField): string | undefined {
  return node.boundVariables?.[field]?.id;
}

/** A length: a number (unbinding a variable it had), or a token bound to its number variable, once. */
export async function writeLength<N extends SceneNode, F extends LengthField & keyof N>(
  node: N,
  field: F,
  value: LengthValue,
  scope: WriteScope,
): Promise<void> {
  if (typeof value === "number") {
    if (boundTo(node, field) !== undefined) {
      node.setBoundVariable(field, null);
    }

    assign(node, field, value as N[F]);

    return;
  }

  const variable = await (await scope.tokens()).variable(value.token, "FLOAT");

  if (boundTo(node, field) !== variable.id) {
    node.setBoundVariable(field, variable);
  }
}

/** Whether a layer lays out its children itself: a flex row or column, or a grid. */
export function hasLayout(node: BaseNode | null): boolean {
  const mode = node !== null && "layoutMode" in node ? node.layoutMode : undefined;

  return typeof mode === "string" && mode !== "NONE";
}

/** A parent's flex direction, when it is a row or a column. */
export function flexOf(node: BaseNode | null): "HORIZONTAL" | "VERTICAL" | null {
  return node !== null && "layoutMode" in node && (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL")
    ? node.layoutMode
    : null;
}
