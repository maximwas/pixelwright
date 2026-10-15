import type { OperationOutput } from "@pixelwright/core";
import { boxOf } from "../../figma/nodes.ts";

/** What the user selected on the current page. */
export async function selection(): Promise<OperationOutput<"selection">> {
  return {
    nodes: figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      box: boxOf(node),
    })),
  };
}
