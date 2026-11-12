import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { requireNode } from "../../figma/nodes.ts";

/** The component set a node is, holds a variant of, or is an instance of a variant of. */
export async function setOf({ node: id }: OperationInput<"set_of">): Promise<OperationOutput<"set_of">> {
  const node = await requireNode(id);
  const main = node.type === "INSTANCE" ? await node.getMainComponentAsync() : node;
  const set = main?.type === "COMPONENT_SET" ? main : main?.parent?.type === "COMPONENT_SET" ? main.parent : null;

  if (set === null || set === undefined) {
    throw new BridgeError("OP_FAILED", `${id} "${node.name}" is not a component set, a variant or an instance of one.`);
  }

  return {
    id: set.id,
    name: set.name,
  };
}
