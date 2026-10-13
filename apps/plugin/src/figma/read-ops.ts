import { BridgeError, type OperationInput, type OperationOutput, type OutlineNode } from "@pixelwright/core";
import { OUTLINE_MAX_NODES } from "../constants/plugin.ts";
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

  if (root.type === "PAGE" && root !== figma.currentPage) {
    // dynamic-page: a page the user is not on has no layers until it is loaded.
    await root.loadAsync();
  }

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

/**
 * The layer tree under a node (the current page when left out) to `depth`, breadth first, so a big frame keeps every
 * section before any of them loses its children to the node limit. Boxes are relative to the outlined node.
 */
export async function outline({ node: id, depth }: OperationInput<"outline">): Promise<OperationOutput<"outline">> {
  const root = id === undefined ? figma.currentPage : await requireNode(id);

  if (root.type === "DOCUMENT") {
    // Pages the user has not opened have no layers until loaded, and loading every page of a big file is slow.
    return {
      root: {
        id: root.id,
        name: root.name,
        type: root.type,
        childCount: root.children.length,
        children: root.children.map((page) => ({
          id: page.id,
          name: page.name,
          type: page.type,
        })),
      },
    };
  }

  if (root.type === "PAGE" && root !== figma.currentPage) {
    // dynamic-page: a page the user is not on has no children until it is loaded.
    await root.loadAsync();
  }

  const origin = boxOf(root) ?? {
    x: 0,
    y: 0,
  };
  const entryOf = async (node: BaseNode): Promise<OutlineNode> => {
    const box = boxOf(node);

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      ...(node.type === "INSTANCE" ? await componentOf(node) : {}),
      ...(box === null
        ? {}
        : {
            x: box.x - origin.x,
            y: box.y - origin.y,
            width: box.width,
            height: box.height,
          }),
      ...("visible" in node && !node.visible ? { hidden: true } : {}),
      childCount: childrenOf(node).length,
    };
  };
  const top = await entryOf(root);
  const queue: { node: BaseNode; entry: OutlineNode; level: number }[] = [
    {
      node: root,
      entry: top,
      level: 0,
    },
  ];
  let listed = 1;

  for (let index = 0; index < queue.length && listed < OUTLINE_MAX_NODES; index++) {
    const { node, entry, level } = queue[index] as (typeof queue)[number];
    const children = childrenOf(node).slice(0, OUTLINE_MAX_NODES - listed);

    if (level >= depth || children.length === 0) {
      continue;
    }

    listed += children.length;
    entry.children = [];

    for (const child of children) {
      const childEntry = await entryOf(child);

      queue.push({
        node: child,
        entry: childEntry,
        level: level + 1,
      });
      entry.children.push(childEntry);
    }
  }

  return { root: top };
}

/** An instance's component, by its set's name for a variant, with the variant as Figma names it. */
async function componentOf(node: InstanceNode): Promise<Pick<OutlineNode, "component" | "variant">> {
  const main = await node.getMainComponentAsync();

  if (main === null) {
    return {};
  }

  return main.parent?.type === "COMPONENT_SET"
    ? {
        component: main.parent.name,
        variant: main.name,
      }
    : { component: main.name };
}

function childrenOf(node: BaseNode): readonly BaseNode[] {
  return "children" in node ? node.children : [];
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
