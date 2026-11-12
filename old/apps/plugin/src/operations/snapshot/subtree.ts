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
  /** A layer whose layers are read before the others', so the budget goes to them first. */
  readonly first?: (node: SceneNode) => boolean;
}

/** A layer and its descendants, breadth first, until the budget (shared by the call) runs out. */
export async function readSubtree(
  root: SceneNode,
  budget: SnapshotBudget,
  options: SubtreeOptions,
): Promise<SnapshotNode> {
  const read = await SubtreeRead.start(root, budget, options);

  await read.expand();

  return read.top;
}

/** A layer waiting for its children to be read: its entry, and how deep it is. */
interface QueuedLayer {
  readonly node: SceneNode;
  readonly entry: SnapshotNode;
  readonly level: number;
}

/** Layers waiting, in the order they came: an index walks them, so nothing is shifted. */
class LayerQueue {
  readonly #layers: QueuedLayer[] = [];
  #at = 0;

  push(layer: QueuedLayer): void {
    this.#layers.push(layer);
  }

  next(): QueuedLayer | undefined {
    const layer = this.#layers[this.#at];

    if (layer !== undefined) {
      this.#at += 1;
    }

    return layer;
  }
}

/**
 * One breadth-first read: the layers `first` picks before the others, each kind in the order they came, until the
 * budget runs out. Started, its root is read; several reads can then take their first layers before any takes the rest.
 */
export class SubtreeRead {
  readonly top: SnapshotNode;
  readonly #budget: SnapshotBudget;
  readonly #options: SubtreeOptions;
  readonly #first = new LayerQueue();
  readonly #rest = new LayerQueue();
  #full = false;

  private constructor(top: SnapshotNode, budget: SnapshotBudget, options: SubtreeOptions) {
    this.top = top;
    this.#budget = budget;
    this.#options = options;
  }

  static async start(root: SceneNode, budget: SnapshotBudget, options: SubtreeOptions): Promise<SubtreeRead> {
    const top = await options.read(root);

    budget.take(top);

    const read = new SubtreeRead(top, budget, options);

    read.#queue({
      node: root,
      entry: top,
      level: 0,
    });

    return read;
  }

  /** Reads the waiting layers' children: those `first` picks, then (unless only those) the rest. */
  async expand({ firstOnly = false }: { readonly firstOnly?: boolean } = {}): Promise<void> {
    for (const queue of firstOnly ? [this.#first] : [this.#first, this.#rest]) {
      for (let layer = queue.next(); layer !== undefined && !this.#full; layer = queue.next()) {
        await this.#expand(layer);
      }
    }
  }

  #queue(layer: QueuedLayer): void {
    ((this.#options.first?.(layer.node) ?? false) ? this.#first : this.#rest).push(layer);
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
      this.#queue({
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
