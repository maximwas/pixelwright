import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { boxOf, pathOf, requireNode } from "../../figma/nodes.ts";

/** Finds layers on the current page (or inside `within`) by name, type, text or component, in document order. */
export async function find(input: OperationInput<"find">): Promise<OperationOutput<"find">> {
  const scope = await scopeOf(input.within);
  const component = input.component?.toLowerCase();
  const candidates = scope.findAll(matcher(input));
  const found: SceneNode[] = [];

  for (const node of candidates) {
    if (component === undefined || (await usesComponent(node, component))) {
      found.push(node);
    }

    if (found.length > input.limit) {
      break;
    }
  }

  return {
    nodes: found.slice(0, input.limit).map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      box: boxOf(node),
      path: pathOf(node),
    })),
    more: found.length > input.limit,
  };
}

/** Where a find searches: the current page, or the layer or page `within` names (a page loaded first). */
async function scopeOf(within: string | undefined): Promise<ChildrenMixin> {
  const root = within === undefined ? figma.currentPage : await requireNode(within);

  if (root.type === "PAGE" && root !== figma.currentPage) {
    // dynamic-page: a page the user is not on has no layers until it is loaded.
    await root.loadAsync();
  }

  if (!("findAll" in root)) {
    throw new BridgeError("NODE_NOT_FOUND", `${within ?? "this page"} has no layers inside to search.`);
  }

  // A page and a frame search the same way: through ChildrenMixin, whose findAll yields layers.
  return root as ChildrenMixin;
}

/** Whether a layer matches the find's name, type and text, and is an instance when a component is asked for. */
function matcher(input: OperationInput<"find">): (node: SceneNode) => boolean {
  const name = input.name?.toLowerCase();
  const type = input.type?.toUpperCase();
  const text = input.text?.toLowerCase();

  return (node) =>
    (name === undefined || node.name.toLowerCase().includes(name)) &&
    (type === undefined || node.type === type) &&
    (text === undefined || (node.type === "TEXT" && node.characters.toLowerCase().includes(text))) &&
    (input.component === undefined || node.type === "INSTANCE");
}

/** Whether an instance's main component, or its component set, is named like the query. */
async function usesComponent(node: SceneNode, query: string): Promise<boolean> {
  if (node.type !== "INSTANCE") {
    return false;
  }

  const main = await node.getMainComponentAsync();
  const names = [main?.name, main?.parent?.type === "COMPONENT_SET" ? main.parent.name : undefined];

  return names.some((candidate) => candidate?.toLowerCase().includes(query));
}
