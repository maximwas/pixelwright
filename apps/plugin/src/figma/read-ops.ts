import { BridgeError, type OperationInput, type OperationOutput, type OutlineNode } from "@pixelwright/core";
import { OUTLINE_MAX_NODES, VIEWPORT_MAX_LAYERS } from "../constants/plugin.ts";
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
export async function show({ node, nodes, zoom, select }: OperationInput<"show">): Promise<OperationOutput<"show">> {
  const ids = nodes ?? (node === undefined ? [] : [node]);

  if (ids.length === 0) {
    throw new BridgeError("OP_FAILED", "Give node or nodes: the layers to show.");
  }

  const layers: SceneNode[] = [];
  let page: PageNode | null = null;

  for (const id of ids) {
    const found = await requireNode(id);
    const on = pageOf(found);

    if (on === null || found.type === "PAGE" || found.type === "DOCUMENT") {
      throw new BridgeError("NODE_NOT_FOUND", `${id} is not a layer on a page.`);
    }

    if (page !== null && on !== page) {
      throw new BridgeError(
        "OP_FAILED",
        `${id} is on page ${on.name}, the others on ${page.name}: show one page at a time.`,
      );
    }

    page = on;
    layers.push(found as SceneNode);
  }

  if (page !== null && page !== figma.currentPage) {
    await figma.setCurrentPageAsync(page);
  }

  if (select) {
    figma.currentPage.selection = layers;
  }

  figma.viewport.scrollAndZoomIntoView(layers);

  if (zoom !== "fit") {
    figma.viewport.zoom = zoom;
  }

  return {
    nodes: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
    })),
    page: page?.name ?? figma.currentPage.name,
    zoom: figma.viewport.zoom,
  };
}

/** What the user sees: the page, the zoom, and the page's layers and their children that meet the view. */
export async function viewport(): Promise<OperationOutput<"viewport">> {
  const { bounds, zoom, center } = figma.viewport;
  const meets = (box: Rect | null) =>
    box !== null &&
    box.x < bounds.x + bounds.width &&
    box.x + box.width > bounds.x &&
    box.y < bounds.y + bounds.height &&
    box.y + box.height > bounds.y;
  const layers: OperationOutput<"viewport">["layers"] = [];
  let more = false;
  const visit = (node: SceneNode, level: number) => {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    if (!node.visible || !meets(box) || box === null) {
      return;
    }

    if (layers.length >= VIEWPORT_MAX_LAYERS) {
      more = true;

      return;
    }

    layers.push({
      id: node.id,
      name: node.name,
      type: node.type,
      box: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    });

    if (level < 1 && "children" in node) {
      for (const child of node.children) {
        visit(child, level + 1);
      }
    }
  };

  for (const node of figma.currentPage.children) {
    visit(node, 0);
  }

  return {
    page: figma.currentPage.name,
    zoom,
    center: {
      x: Math.round(center.x),
      y: Math.round(center.y),
    },
    bounds: {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    },
    layers,
    more,
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
