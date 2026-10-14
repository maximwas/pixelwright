import type { SnapshotNode } from "@pixelwright/core";
import { SNAPSHOT_MAX_CHARS } from "./constants.ts";

/** The characters a call's entries have taken: one budget for every layer a call reads. */
export class SnapshotBudget {
  #used = 0;

  /** Counts an entry in; false once the call is past its budget. */
  take(entry: SnapshotNode): boolean {
    this.#used += JSON.stringify(entry).length;

    return this.#used <= SNAPSHOT_MAX_CHARS;
  }
}

/** How a breadth-first read goes: how deep, how a layer is read, and which hidden layers it opens all the same. */
export interface SubtreeOptions {
  readonly depth?: number | undefined;
  readonly read: (node: SceneNode) => Promise<SnapshotNode>;
  /** A hidden layer whose layers are read all the same. */
  readonly open?: (node: SceneNode) => boolean;
}

/** A layer and its descendants, breadth first, until the budget (shared by the call) runs out. */
export function readSubtree(root: SceneNode, budget: SnapshotBudget, options: SubtreeOptions): Promise<SnapshotNode> {
  return new SubtreeRead(budget, options).run(root);
}

/** A layer waiting for its children to be read: its entry, and how deep it is. */
interface QueuedLayer {
  readonly node: SceneNode;
  readonly entry: SnapshotNode;
  readonly level: number;
}

/** One breadth-first read: the layers waiting, and whether the budget has run out. */
class SubtreeRead {
  readonly #budget: SnapshotBudget;
  readonly #options: SubtreeOptions;
  readonly #queue: QueuedLayer[] = [];
  #full = false;

  constructor(budget: SnapshotBudget, options: SubtreeOptions) {
    this.#budget = budget;
    this.#options = options;
  }

  async run(root: SceneNode): Promise<SnapshotNode> {
    const top = await this.#options.read(root);

    this.#budget.take(top);
    this.#queue.push({
      node: root,
      entry: top,
      level: 0,
    });

    for (let index = 0; index < this.#queue.length && !this.#full; index++) {
      await this.#expand(this.#queue[index] as QueuedLayer);
    }

    return top;
  }

  /** Reads a layer's children into its entry, as far as the depth and the budget go. */
  async #expand({ node, entry, level }: QueuedLayer): Promise<void> {
    const { depth, read, open = () => false } = this.#options;

    if (
      (depth !== undefined && level >= depth) ||
      !("children" in node) ||
      (level > 0 && !node.visible && !open(node))
    ) {
      return;
    }

    const children: SnapshotNode[] = [];

    for (const child of node.children) {
      const childEntry = await read(child);

      if (!this.#budget.take(childEntry)) {
        this.#full = true;
        break;
      }

      children.push(childEntry);
      this.#queue.push({
        node: child,
        entry: childEntry,
        level: level + 1,
      });
    }

    if (children.length > 0) {
      entry.children = children;
    }
  }
}
