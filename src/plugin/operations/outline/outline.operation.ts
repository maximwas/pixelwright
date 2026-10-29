import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
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
 * outlined node and unrounded: the server rounds them (D-15). The document lists its pages, unloaded. Instances name
 * their component until the op's deadline (P-075).
 */
@injectable()
export class OutlineOperation extends Operation<OutlineInput, OutlineOutput> {
  readonly #loader;
  readonly #refs;
  readonly #layerWalk;

  constructor(
    report = inject(OP_REPORT),
    loader = inject(PAGE_LOADER),
    refs = inject(LAYER_REFS),
    layerWalk = inject(LAYER_WALK),
  ) {
    super(report);
    this.#loader = loader;
    this.#refs = refs;
    this.#layerWalk = layerWalk;
  }

  protected async execute({ node, depth }: OutlineInput): Promise<OutlineOutput> {
    // The deadline counts the page's loading too, as find's does.
    const deadline = this.#layerWalk.deadline();
    const root = await this.#loader.root(node);

    if (root.type === FIGMA_NODE_TYPE.document) {
      return { root: this.#pages(root) };
    }

    if (root.type === FIGMA_NODE_TYPE.page) {
      // dynamic-page: a page the user is not on has no children until it is loaded.
      await this.#loader.load(root);
    }

    const walk: Walk = { origin: this.#box(root) ?? { x: 0, y: 0 }, instances: [] };
    const top = this.#tree(root, depth, walk);

    await this.#layerWalk.lookUp(walk.instances, deadline, {
      lookup: async ([, instance]) => await instance.getMainComponentAsync(),
      take: ([entry], main) => this.#named(entry, main),
      enough: () => false,
    });

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
    const dev = this.#refs.devStatus(node);
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

    if (node.type === FIGMA_NODE_TYPE.instance) {
      walk.instances.push([entry, node]);
    }

    return entry;
  }

  /** An instance's entry names its component: by its set's name for a variant, with the variant as Figma names it. */
  #named(entry: OutlineNode, main: ComponentNode | null): void {
    const set = main?.parent?.type === FIGMA_NODE_TYPE.componentSet ? main.parent : null;

    if (main !== null) {
      Object.assign(entry, set === null ? { component: main.name } : { component: set.name, variant: main.name });
    }
  }

  /** The layer's box in page px; null for a node Figma gives none (a page, the document). */
  #box(node: BaseNode): Rect | null {
    return "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  }

  #children(node: BaseNode): readonly BaseNode[] {
    return "children" in node ? node.children : [];
  }
}
