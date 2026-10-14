import { BridgeError } from "@pixelwright/core";

/** A node by id, or NODE_NOT_FOUND naming the id (documentAccess dynamic-page: only the async lookup works). */
export async function requireNode(id: string): Promise<BaseNode> {
  const node = await figma.getNodeByIdAsync(id);

  if (node === null) {
    throw new BridgeError(
      "NODE_NOT_FOUND",
      `No node ${id} in this file: find ids with nodes_find, outline or selection_get.`,
    );
  }

  return node;
}

/** The node's box in page coordinates, whole pixels; null for nodes without one (pages, the document). */
export function boxOf(node: BaseNode): { x: number; y: number; width: number; height: number } | null {
  const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

  if (box === null) {
    return null;
  }

  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/** The page a node lives on. */
export function pageOf(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;

  while (current !== null && current.type !== "PAGE") {
    current = current.parent;
  }

  return current;
}

/** The names of a node's ancestors below its page, outermost first. */
export function pathOf(node: BaseNode): string[] {
  const names: string[] = [];
  let current = node.parent;

  while (current !== null && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    names.unshift(current.name);
    current = current.parent;
  }

  return names;
}

/** dynamic-page: a page the user is not on has its layers once loaded. */
export async function loadPageOf(node: BaseNode): Promise<void> {
  const page = node.type === "PAGE" ? node : pageOf(node);

  if (page !== null && page !== figma.currentPage) {
    await page.loadAsync();
  }
}

/** A node with its parents, as Figma's nodes and the layers design_apply writes both have. */
interface Nested {
  readonly type: string;
  readonly parent: Nested | null;
}

/** Whether a layer comes from a component through an instance (its place and layers are the component's). */
export function insideInstance(node: Nested): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "INSTANCE") {
      return true;
    }
  }

  return false;
}

/** Where a child stands among its parent's children; -1 when it is not one of them. */
export function indexIn(parent: BaseNode, child: { readonly id: string }): number {
  const children: readonly BaseNode[] = "children" in parent ? parent.children : [];

  return children.findIndex((node) => node.id === child.id);
}

/** A layer's id inside the instance holding it, I<instance>;<path>, as the same in every instance of the component. */
export function instancePath(id: string): string {
  return id.replace(/^I[^;]+;/, "");
}
