import type { OperationInput, OperationOutput, OutlineNode } from "@pixelwright/core";
import { MAIN_COMPONENT_BATCH, OP_BUDGET_MS } from "../../constants/plugin.ts";
import { devStatusOf } from "../../figma/dev-status.ts";
import { boxOf, requireNode } from "../../figma/nodes.ts";
import { componentNames } from "../../figma/variants.ts";
import { OUTLINE_MAX_NODES } from "./constants.ts";

/**
 * The layer tree under a node (the current page when left out) to `depth`, breadth first, so a big frame keeps every
 * section before any of them loses its children to the node limit. Boxes are relative to the outlined node.
 */
export async function outline({ node: id, depth }: OperationInput<"outline">): Promise<OperationOutput<"outline">> {
  const root = id === undefined ? figma.currentPage : await requireNode(id);

  if (root.type === "DOCUMENT") {
    return { root: pagesOf(root) };
  }

  if (root.type === "PAGE" && root !== figma.currentPage) {
    // dynamic-page: a page the user is not on has no children until it is loaded.
    await root.loadAsync();
  }

  const read = new OutlineRead(root);
  const top = read.tree(depth);

  await read.nameComponents();

  return { root: top };
}

/** The document as its pages, unloaded: pages the user has not opened have no layers until loaded, which is slow. */
function pagesOf(document: DocumentNode): OutlineNode {
  return {
    id: document.id,
    name: document.name,
    type: document.type,
    childCount: document.children.length,
    children: document.children.map((page) => ({
      id: page.id,
      name: page.name,
      type: page.type,
    })),
  };
}

/** A layer waiting for its children to be listed: its entry, and how deep it is. */
interface QueuedNode {
  readonly node: BaseNode;
  readonly entry: OutlineNode;
  readonly level: number;
}

/** One outline: its origin, and the instances listed, which name their component once the tree is laid out. */
class OutlineRead {
  readonly #root: BaseNode;
  readonly #origin: { x: number; y: number };
  readonly #instances: [OutlineNode, InstanceNode][] = [];

  constructor(root: BaseNode) {
    this.#root = root;
    this.#origin = boxOf(root) ?? {
      x: 0,
      y: 0,
    };
  }

  /** The tree to `depth`, breadth first, until the node limit. */
  tree(depth: number): OutlineNode {
    const top = this.#entryOf(this.#root);
    const queue: QueuedNode[] = [
      {
        node: this.#root,
        entry: top,
        level: 0,
      },
    ];
    let listed = 1;

    for (let index = 0; index < queue.length && listed < OUTLINE_MAX_NODES; index++) {
      const { node, entry, level } = queue[index] as QueuedNode;
      const children = childrenOf(node).slice(0, OUTLINE_MAX_NODES - listed);

      if (level < depth && children.length > 0) {
        listed += children.length;
        entry.children = children.map((child) => {
          const childEntry = this.#entryOf(child);

          queue.push({
            node: child,
            entry: childEntry,
            level: level + 1,
          });

          return childEntry;
        });
      }
    }

    return top;
  }

  /** Each listed instance's component, looked up in batches within the operation's time. */
  async nameComponents(): Promise<void> {
    const deadline = Date.now() + OP_BUDGET_MS;

    for (let start = 0; start < this.#instances.length && Date.now() < deadline; start += MAIN_COMPONENT_BATCH) {
      await Promise.all(
        this.#instances.slice(start, start + MAIN_COMPONENT_BATCH).map(async ([entry, node]) => {
          Object.assign(entry, await componentOf(node));
        }),
      );
    }
  }

  #entryOf(node: BaseNode): OutlineNode {
    const box = boxOf(node);
    const dev = devStatusOf(node);
    const entry: OutlineNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      ...(box === null
        ? {}
        : {
            x: box.x - this.#origin.x,
            y: box.y - this.#origin.y,
            width: box.width,
            height: box.height,
          }),
      ...("visible" in node && !node.visible ? { hidden: true } : {}),
      ...(dev === undefined ? {} : { dev }),
      childCount: childrenOf(node).length,
    };

    if (node.type === "INSTANCE") {
      this.#instances.push([entry, node]);
    }

    return entry;
  }
}

/** An instance's component, by its set's name for a variant, with the variant as Figma names it. */
async function componentOf(node: InstanceNode): Promise<Pick<OutlineNode, "component" | "variant">> {
  const main = await node.getMainComponentAsync();

  return main === null ? {} : componentNames(main);
}

function childrenOf(node: BaseNode): readonly BaseNode[] {
  return "children" in node ? node.children : [];
}
