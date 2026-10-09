import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { boxOf, pageOf, pathOf, requireNode } from "./nodes.ts";

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

/** Selects a node and brings it into view, switching to its page when needed. */
export async function show({ node: id }: OperationInput<"show">): Promise<OperationOutput<"show">> {
  const node = await requireNode(id);
  const page = pageOf(node);

  if (page === null || node.type === "PAGE" || node.type === "DOCUMENT") {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is not a layer on a page.`);
  }

  if (page !== figma.currentPage) {
    await figma.setCurrentPageAsync(page);
  }

  const layer = node as SceneNode;

  figma.currentPage.selection = [layer];
  figma.viewport.scrollAndZoomIntoView([layer]);

  return {
    id: node.id,
    name: node.name,
    page: page.name,
  };
}

/** Finds layers on the current page (or inside `within`) by name, type, text or component, in document order. */
export async function find(input: OperationInput<"find">): Promise<OperationOutput<"find">> {
  const root = input.within === undefined ? figma.currentPage : await requireNode(input.within);

  if (!("findAll" in root)) {
    throw new BridgeError("NODE_NOT_FOUND", `${input.within ?? "this page"} has no layers inside to search.`);
  }

  const name = input.name?.toLowerCase();
  const type = input.type?.toUpperCase();
  const text = input.text?.toLowerCase();
  const component = input.component?.toLowerCase();
  // A page and a frame search the same way: through ChildrenMixin, whose findAll yields layers.
  const scope = root as ChildrenMixin;
  const candidates = scope.findAll(
    (node) =>
      (name === undefined || node.name.toLowerCase().includes(name)) &&
      (type === undefined || node.type === type) &&
      (text === undefined || (node.type === "TEXT" && node.characters.toLowerCase().includes(text))) &&
      (component === undefined || node.type === "INSTANCE"),
  );
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

/** Whether an instance's main component, or its component set, is named like the query. */
async function usesComponent(node: SceneNode, query: string): Promise<boolean> {
  if (node.type !== "INSTANCE") {
    return false;
  }

  const main = await node.getMainComponentAsync();
  const names = [main?.name, main?.parent?.type === "COMPONENT_SET" ? main.parent.name : undefined];

  return names.some((candidate) => candidate?.toLowerCase().includes(query));
}
