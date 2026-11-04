import { InjectionToken, inject, injectable } from "@needle-di/core";
import { Area, type Box } from "@/core/kernel/geometry/area.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { CUT_REASON } from "@/shared/envelope/op-result.constants.ts";
import type { ReadCut } from "@/shared/ops/read/read.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** What a read walks, so its budget is tested over plain data: a node's own entry and its children. */
export interface ReadTree<Node> {
  /** The node's entry without its children, its box from `root`'s corner; a hidden one below the root a stub. */
  entry(node: Node, root: Node): ReadLayer | Promise<ReadLayer>;
  children(node: Node): readonly Node[];
  /** The layer the node sits in; null at its page. */
  parent(node: Node): Node | null;
  /** The node's box on the canvas when it is shown; null when it is hidden or has none. */
  box(node: Node): Box | null;
}

/** How far a read goes: levels below each root (all when left out), and the JSON characters all its entries take. */
interface ReadLimits {
  readonly depth?: number | undefined;
  readonly jsonChars: number;
  /** Whether each root's layers above it are read too (ReadModel.ancestors). */
  readonly ancestors?: boolean | undefined;
}

/**
 * What a read gives: an entry per root, in the order given, with the children it read; per root, its layers above it
 * when asked (none when not); the cuts.
 */
interface ReadResult {
  readonly layers: ReadLayer[];
  readonly ancestors: ReadLayer[][];
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
  readonly deadline: number;
  used: number;
}

/**
 * Layers and their descendants, breadth first under one JSON budget for the whole call (T-053, 0.7.0's snapshot), so
 * every section of a big frame is read before any section's insides. A hidden layer below a root stays a stub (D-18).
 * Every layer whose children were not all read is a cut (K-034): `depth` stopped it, or the budget did, mid-children
 * too (m:ec973ea3). The budget is the JSON's characters and the op's time (P-075). The roots are read whatever the
 * budget. Asked for, each root's layers above it come after the roots' own, under what is left of the budget.
 */
@injectable()
export class ReadRun {
  readonly #walk;

  constructor(walk = inject(LAYER_WALK)) {
    this.#walk = walk;
  }

  async read<Node>(
    roots: readonly Node[],
    tree: ReadTree<Node>,
    limits: ReadLimits,
  ): Promise<ReadResult> {
    // Every op's walk budget (LIMITS.opBudgetMs): each layer awaits Figma (a main component, a destination's name), and
    // a big frame must answer with what it read before the server stops waiting.
    const walk: Walk<Node> = { tree, limits, queue: [], cuts: [], used: 0, deadline: this.#walk.deadline() };
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

    const ancestors: ReadLayer[][] = [];

    if (limits.ancestors) {
      // The roots' walk is done: the queue now takes what lies around them.
      walk.queue.splice(0);

      for (const root of roots) {
        ancestors.push(await this.#ancestors(walk, root));
      }

      for (const queued of walk.queue) {
        await this.#expand(walk, queued);
      }
    }

    return { layers, ancestors, cuts: walk.cuts };
  }

  /**
   * The layers above a root up to its page, nearest first (0.7.0's snapshot): each with those of its shown children
   * whose box meets the root's, queued to be read whole, and the child the root is in as a bare entry, so a reader
   * knows where the root sits (styles_compare places a layer in its parent, T-090).
   */
  async #ancestors<Node>(walk: Walk<Node>, root: Node): Promise<ReadLayer[]> {
    const { tree } = walk;
    const box = tree.box(root);
    const ancestors: ReadLayer[] = [];
    let inner = root;

    for (let parent = tree.parent(root); parent !== null; parent = tree.parent(parent)) {
      const entry = await tree.entry(parent, root);
      const children: ReadLayer[] = [];

      for (const child of tree.children(parent)) {
        const meets = child !== inner && this.#meets(tree.box(child), box);

        if (child === inner || meets) {
          const read = await tree.entry(child, root);

          walk.used += JSON.stringify(read).length;
          children.push(read);

          if (meets) {
            walk.queue.push({ node: child, root, entry: read, level: 0 });
          }
        }
      }

      entry.children = children;
      ancestors.push(entry);
      inner = parent;
    }

    return ancestors;
  }

  #meets(box: Box | null, root: Box | null): boolean {
    return box !== null && root !== null && new Area(box).overlaps(new Area(root));
  }

  /** Reads a layer's children into its entry, as far as the depth, the budget and the deadline go. */
  async #expand<Node>(walk: Walk<Node>, queued: Queued<Node>): Promise<void> {
    const { entry, level } = queued;
    const { depth, jsonChars } = walk.limits;

    if (entry.childCount === 0 || (level > 0 && !entry.visible)) {
      return;
    }

    const spent = walk.used > jsonChars || this.#walk.passed(walk.deadline);

    if ((depth !== undefined && level >= depth) || spent) {
      walk.cuts.push({ id: entry.id, reason: spent ? CUT_REASON.budget : CUT_REASON.children });

      return;
    }

    const children = await this.#children(walk, queued);

    if (children.length > 0) {
      entry.children = children;
    }

    if (children.length < entry.childCount) {
      walk.cuts.push({ id: entry.id, reason: CUT_REASON.budget });
    }
  }

  /** The layer's children read in order, each queued for its own, until the budget or the deadline stops them. */
  async #children<Node>(walk: Walk<Node>, { node, root, level }: Queued<Node>): Promise<ReadLayer[]> {
    const children: ReadLayer[] = [];

    for (const child of walk.tree.children(node)) {
      if (this.#walk.passed(walk.deadline)) {
        break;
      }

      const read = await walk.tree.entry(child, root);

      walk.used += JSON.stringify(read).length;

      if (walk.used > walk.limits.jsonChars) {
        break;
      }

      children.push(read);
      walk.queue.push({ node: child, root, entry: read, level: level + 1 });
    }

    return children;
  }
}

export const READ_RUN = new InjectionToken<ReadRun>("ReadRun");
