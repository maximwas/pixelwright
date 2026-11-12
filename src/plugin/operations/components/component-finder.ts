import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { COMPONENT_ENTRIES } from "@/plugin/operations/components/component-entries.ts";
import type { ComponentOwner, FoundComponents } from "@/plugin/operations/components/components.types.ts";
import { COMPONENT_TYPE } from "@/shared/ops/components/components.constants.ts";
import type { ComponentEntry } from "@/shared/ops/components/components.schema.ts";
import type { PageNotRead } from "@/shared/ops/file-map/file-map.schema.ts";

/** One walk's findings as it goes; whether the deadline cut it is added at the end. */
interface Tally {
  readonly entries: Map<string, ComponentEntry>;
  readonly owners: Map<string, ComponentOwner>;
  readonly instances: Map<string, InstanceNode>;
  readonly notRead: PageNotRead[];
  readonly deadline: number;
}

/**
 * The components to list (T-190, P-124). Local: the sets and lone components every page defines (each page loaded in
 * turn, one Figma cannot load noted), or `within` defines, itself counted, a variant listed under its set. Used: the
 * ones the instances in `within` (the current page by default, an instance itself counted) come from, their mains asked
 * a batch at a time and counted. Both stop at the op's deadline (P-075) with what they reached.
 */
@injectable()
export class ComponentFinder {
  readonly #defining: NodeType[] = [COMPONENT_TYPE.set, COMPONENT_TYPE.component];
  readonly #using: NodeType[] = [FIGMA_NODE_TYPE.instance];
  readonly #loader;
  readonly #lookup;
  readonly #walk;
  readonly #entries;

  constructor(
    loader = inject(PAGE_LOADER),
    lookup = inject(NODE_LOOKUP),
    walk = inject(LAYER_WALK),
    entries = inject(COMPONENT_ENTRIES),
  ) {
    this.#loader = loader;
    this.#lookup = lookup;
    this.#walk = walk;
    this.#entries = entries;
  }

  async local(within: string | undefined): Promise<FoundComponents> {
    const tally = this.#tally();
    const roots: readonly BaseNode[] = within === undefined ? this.#loader.pages() : [await this.#loader.root(within)];

    for (const root of roots) {
      if (this.#walk.passed(tally.deadline)) {
        return { ...tally, cut: true };
      }

      if (await this.#readable(root, tally.notRead)) {
        for (const node of [root, ...this.#below(root, this.#defining)]) {
          this.#define(node, tally);
        }
      }
    }

    return { ...tally, cut: false };
  }

  async used(within: string | undefined): Promise<FoundComponents> {
    const tally = this.#tally();
    const root = await this.#loader.root(within);

    if (!(await this.#readable(root, tally.notRead))) {
      return { ...tally, cut: false };
    }

    const instances = [root, ...this.#below(root, this.#using)].filter(
      (node): node is InstanceNode => node.type === FIGMA_NODE_TYPE.instance,
    );
    const cut = await this.#walk.lookUp(instances, tally.deadline, {
      lookup: (instance) => instance.getMainComponentAsync(),
      take: (instance, main) => {
        if (main !== null) {
          this.#count(this.#entries.owner(main), instance, tally);
        }
      },
      enough: () => false,
    });

    return { ...tally, cut };
  }

  #tally(): Tally {
    return {
      entries: new Map(),
      owners: new Map(),
      instances: new Map(),
      notRead: [],
      deadline: this.#walk.deadline(),
    };
  }

  /** Whether a root's layers can be read: its page loaded first, one Figma cannot load noted. */
  async #readable(root: BaseNode, notRead: PageNotRead[]): Promise<boolean> {
    const page = this.#lookup.pageOf(root);

    return page === null || (await this.#loader.loaded(page, notRead));
  }

  /** The layers of these types inside a node (a page, a frame, a set), not the node itself. */
  #below(node: BaseNode, types: NodeType[]): readonly BaseNode[] {
    return "findAllWithCriteria" in node ? node.findAllWithCriteria({ types }) : [];
  }

  /** A set, or a component outside a set, is listed; a variant is its set's. */
  #define(node: BaseNode, tally: Tally): void {
    if (
      node.type === COMPONENT_TYPE.set ||
      (node.type === COMPONENT_TYPE.component && node.parent?.type !== COMPONENT_TYPE.set)
    ) {
      tally.entries.set(node.id, this.#entries.entry(node));
      tally.owners.set(node.id, node);
    }
  }

  /** One more instance of the set or component, the first one kept: a library component's links are read there. */
  #count(
    owner: ComponentOwner,
    instance: InstanceNode,
    tally: Tally,
  ): void {
    const entry = tally.entries.get(owner.id) ?? this.#entries.entry(owner);

    tally.entries.set(owner.id, { ...entry, instances: (entry.instances ?? 0) + 1 });
    tally.owners.set(owner.id, owner);

    if (!tally.instances.has(owner.id)) {
      tally.instances.set(owner.id, instance);
    }
  }
}

export const COMPONENT_FINDER = new InjectionToken<ComponentFinder>("ComponentFinder");
