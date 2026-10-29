import { InjectionToken, injectable } from "@needle-di/core";
import { CUT_REASON } from "@/shared/envelope/op-result.constants.ts";
import type { ReadCut } from "@/shared/ops/read/read.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** What a read walks, so its budget is tested over plain data: a node's own entry and its children. */
export interface ReadTree<Node> {
  /** The node's entry without its children, its box from `root`'s corner; a hidden one a stub. */
  entry(node: Node, root: Node): ReadLayer | Promise<ReadLayer>;
  children(node: Node): readonly Node[];
}

/** How far a read goes: levels below each root (all when left out), and the JSON characters all its entries take. */
interface ReadLimits {
  readonly depth?: number | undefined;
  readonly jsonChars: number;
}

/** What a read gives: an entry per root, in the order given, with the children it read; the cuts. */
interface ReadResult {
  readonly layers: ReadLayer[];
  readonly cuts: ReadCut[];
}

/** An entry whose children are still to read: its node, the root its box starts from, and how deep it is. */
interface Queued<Node> {
  readonly node: Node;
  readonly root: Node;
  readonly entry: ReadLayer;
  readonly level: number;
}

/** One read's walk: the entries in reading order, the cuts so far, the characters taken. */
interface Walk<Node> {
  readonly tree: ReadTree<Node>;
  readonly limits: ReadLimits;
  readonly queue: Queued<Node>[];
  readonly cuts: ReadCut[];
  used: number;
}

/**
 * Layers and their descendants, breadth first under one JSON budget for the whole call (T-053, 0.7.0's snapshot), so
 * every section of a big frame is read before any section's insides. A hidden layer below a root stays a stub (D-18).
 * Every layer whose children were not all read is a cut (K-034): `depth` stopped it, or the budget did, mid-children
 * too (m:ec973ea3). The roots are read whatever the budget.
 */
@injectable()
export class ReadRun {
  async read<Node>(
    roots: readonly Node[],
    tree: ReadTree<Node>,
    limits: ReadLimits,
  ): Promise<ReadResult> {
    const walk: Walk<Node> = { tree, limits, queue: [], cuts: [], used: 0 };
    const layers: ReadLayer[] = [];

    for (const root of roots) {
      const entry = await tree.entry(root, root);

      walk.used += JSON.stringify(entry).length;
      walk.queue.push({ node: root, root, entry, level: 0 });
      layers.push(entry);
    }

    // The queue grows while it is walked: for...of reads its length at every step, which makes the walk breadth first.
    for (const queued of walk.queue) {
      await this.#expand(walk, queued);
    }

    return { layers, cuts: walk.cuts };
  }

  /** Reads a layer's children into its entry, as far as the depth and the budget go. */
  async #expand<Node>(walk: Walk<Node>, { node, root, entry, level }: Queued<Node>): Promise<void> {
    const { depth, jsonChars } = walk.limits;

    if (entry.childCount === 0 || (level > 0 && !entry.visible)) {
      return;
    }

    if ((depth !== undefined && level >= depth) || walk.used > jsonChars) {
      walk.cuts.push({ id: entry.id, reason: walk.used > jsonChars ? CUT_REASON.budget : CUT_REASON.children });

      return;
    }

    const children: ReadLayer[] = [];

    for (const child of walk.tree.children(node)) {
      const read = await walk.tree.entry(child, root);

      walk.used += JSON.stringify(read).length;

      if (walk.used > jsonChars) {
        break;
      }

      children.push(read);
      walk.queue.push({ node: child, root, entry: read, level: level + 1 });
    }

    if (children.length > 0) {
      entry.children = children;
    }

    if (children.length < entry.childCount) {
      walk.cuts.push({ id: entry.id, reason: CUT_REASON.budget });
    }
  }
}

export const READ_RUN = new InjectionToken<ReadRun>("ReadRun");
