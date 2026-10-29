import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CANVAS_VIEW } from "@/plugin/adapters/figma/canvas-view.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { FIGMA_DEV_STATUS, OUTLINE_NODE_TYPE } from "@/plugin/operations/outline/outline.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import type { outlineOp } from "@/shared/ops/outline/outline.manifest.ts";
import type { OutlineNode } from "@/shared/ops/outline/outline.schema.ts";

type OutlineInput = zod.output<typeof outlineOp.input>;

type OutlineOutput = zod.output<typeof outlineOp.output>;

/** A listed layer whose children are still to list: its entry, and how deep it is. */
interface Queued {
  readonly node: BaseNode;
  readonly entry: OutlineNode;
  readonly level: number;
}

/** One outline's walk: where its boxes start, and the instances it lists, which name their component at the end. */
interface Walk {
  readonly origin: Vector;
  readonly instances: [OutlineNode, InstanceNode][];
}

/**
 * The layer tree under a layer or a page, the current page when none is given, to `depth` levels (T-044), breadth
 * first, so a big frame keeps every section before any loses its children to the node limit. Boxes are relative to the
 * outlined node and unrounded: the server rounds them (D-15). The document lists its pages, unloaded.
 */
@injectable()
export class OutlineOperation extends Operation<OutlineInput, OutlineOutput> {
  readonly #lookup;
  readonly #view;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    view = inject(CANVAS_VIEW),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#view = view;
  }

  protected async execute({ node, depth }: OutlineInput): Promise<OutlineOutput> {
    const root = node === undefined ? this.#view.page() : await this.#lookup.existing(node);

    if (root.type === OUTLINE_NODE_TYPE.document) {
      return { root: this.#pages(root) };
    }

    if (root.type === OUTLINE_NODE_TYPE.page && root !== this.#view.page()) {
      // dynamic-page: a page the user is not on has no children until it is loaded.
      await root.loadAsync();
    }

    const walk: Walk = { origin: this.#box(root) ?? { x: 0, y: 0 }, instances: [] };
    const top = this.#tree(root, depth, walk);

    await this.#nameComponents(walk.instances, Date.now() + LIMITS.opBudgetMs);

    return { root: top };
  }

  /** The document as its pages, unloaded: a page the user has not opened has no layers until loaded, which is slow. */
  #pages(document: DocumentNode): OutlineNode {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      childCount: document.children.length,
      children: document.children.map(({ id, name, type }) => ({ id, name, type })),
    };
  }

  /** The tree to `depth`, breadth first, until the outline lists LIMITS.outlineNodes layers. */
  #tree(
    root: BaseNode,
    depth: number,
    walk: Walk,
  ): OutlineNode {
    const top = this.#entry(root, walk);
    const queue: Queued[] = [{ node: root, entry: top, level: 0 }];
    let listed = 1;

    // The queue grows while it is walked: for...of visits what is pushed meanwhile.
    for (const { node, entry, level } of queue) {
      if (listed >= LIMITS.outlineNodes) {
        break;
      }

      const children = this.#children(node).slice(0, LIMITS.outlineNodes - listed);

      if (level < depth && children.length > 0) {
        listed += children.length;
        entry.children = children.map((child) => {
          const childEntry = this.#entry(child, walk);

          queue.push({ node: child, entry: childEntry, level: level + 1 });

          return childEntry;
        });
      }
    }

    return top;
  }

  #entry(node: BaseNode, walk: Walk): OutlineNode {
    const box = this.#box(node);
    const dev = this.#dev(node);
    const entry: OutlineNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      ...(box === null
        ? {}
        : { x: box.x - walk.origin.x, y: box.y - walk.origin.y, width: box.width, height: box.height }),
      ...("visible" in node && !node.visible ? { hidden: true } : {}),
      ...(dev === undefined ? {} : { dev }),
      childCount: this.#children(node).length,
    };

    if (node.type === OUTLINE_NODE_TYPE.instance) {
      walk.instances.push([entry, node]);
    }

    return entry;
  }

  /**
   * Each listed instance's component, by its set's name for a variant with the variant as Figma names it, looked up in
   * batches until the op's time is spent; instances past it stay unnamed.
   */
  async #nameComponents(instances: readonly [OutlineNode, InstanceNode][], deadline: number): Promise<void> {
    const batch = instances.slice(0, LIMITS.mainComponentBatch);

    if (batch.length === 0 || Date.now() >= deadline) {
      return;
    }

    await Promise.all(
      batch.map(async ([entry, instance]) => {
        const main = await instance.getMainComponentAsync();
        const set = main?.parent?.type === OUTLINE_NODE_TYPE.componentSet ? main.parent : null;

        if (main !== null) {
          Object.assign(entry, set === null ? { component: main.name } : { component: set.name, variant: main.name });
        }
      }),
    );
    await this.#nameComponents(instances.slice(LIMITS.mainComponentBatch), deadline);
  }

  /** The layer's Dev Mode status; none when unmarked. */
  #dev(node: BaseNode): OutlineNode["dev"] {
    const status = "devStatus" in node ? node.devStatus : null;

    return status === null ? undefined : FIGMA_DEV_STATUS[status.type];
  }

  /** The layer's box in page px; null for a node Figma gives none (a page, the document). */
  #box(node: BaseNode): Rect | null {
    return "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  }

  #children(node: BaseNode): readonly BaseNode[] {
    return "children" in node ? node.children : [];
  }
}
