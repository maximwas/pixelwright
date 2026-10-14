import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { pageOf, requireNode } from "../../figma/nodes.ts";
import { loaded } from "../../figma/used-tokens.ts";
import { screensOf } from "./screens-of.ts";

/** The screen a layer is on, and the page's other screens, each with its children's names (for breakpoints_find). */
export async function screens({ node: id }: OperationInput<"screens">): Promise<OperationOutput<"screens">> {
  const node = await requireNode(id);
  const page = pageOf(node);

  if (page === null) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is not a layer on a page.`);
  }

  await loaded(page);

  const all = screensOf(page);
  const target = all.find((screen) => screen === node || contains(screen, node));

  if (target === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      `${id} "${node.name}" is on no screen: give a frame on the page or a layer in one.`,
    );
  }

  return {
    target: described(target),
    screens: all.filter((screen) => screen !== target).map(described),
  };
}

function described(screen: SceneNode) {
  return {
    id: screen.id,
    name: screen.name,
    width: Math.round(screen.width),
    height: Math.round(screen.height),
    children: "children" in screen ? screen.children.map((child) => child.name) : [],
  };
}

function contains(ancestor: BaseNode, node: BaseNode): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }

  return false;
}
