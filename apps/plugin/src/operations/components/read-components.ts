import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { MAIN_COMPONENT_BATCH, OP_BUDGET_MS } from "../../constants/plugin.ts";
import { requireNode } from "../../figma/nodes.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { type ComponentEntry, type ComponentOwner, componentEntryOf } from "./component-entry.ts";
import { type LinkSources, withLinks } from "./component-links.ts";
import { exposedOf } from "./exposed-instances.ts";

/**
 * The file's own components (every page, loaded one at a time) or the ones the instances in a layer come from, local
 * or from a library; `within` itself counts. A variant is listed under its set; properties are read from the set, never
 * from a variant, where Figma throws. Each listed one comes with the nested instances it exposes, and with its Dev Mode
 * links when asked. A big file answers within OP_BUDGET_MS with what it has and more: true.
 */
export async function components({
  scope,
  within,
  query,
  limit,
  links,
}: OperationInput<"components">): Promise<OperationOutput<"components">> {
  const found = new FoundComponents();

  await (scope === "local" ? found.addLocal(within) : found.addUsed(within));

  const wanted = query?.toLowerCase();
  const matching = found.entries().filter((entry) => wanted === undefined || entry.name.toLowerCase().includes(wanted));
  const listed = await found.withExposed(matching.slice(0, limit));
  const answer = {
    more: found.cut || matching.length > limit,
    ...(found.pagesNotRead.length === 0 ? {} : { pagesNotRead: found.pagesNotRead }),
  };

  if (!links) {
    return {
      components: listed,
      ...answer,
    };
  }

  const linked = await withLinks(listed, found, found.started);

  return {
    components: linked.entries,
    ...answer,
    linksRead: true,
    ...(linked.note === undefined ? {} : { linksNote: linked.note }),
  };
}

/** The components found by id, with their nodes and an instance of each used one, and whether the time ran out first. */
class FoundComponents implements LinkSources {
  cut = false;
  /** The pages Figma could not load, with its words. */
  readonly pagesNotRead: { name: string; error: string }[] = [];
  readonly started = Date.now();
  readonly #found = new Map<string, ComponentEntry>();
  readonly #owners = new Map<string, ComponentOwner>();
  readonly #instances = new Map<string, InstanceNode>();

  entries(): ComponentEntry[] {
    return [...this.#found.values()];
  }

  owner(id: string): ComponentOwner | undefined {
    return this.#owners.get(id);
  }

  instanceOf(id: string): InstanceNode | undefined {
    return this.#instances.get(id);
  }

  /** The entries with the nested instances their components expose, where there are any. */
  async withExposed(entries: readonly ComponentEntry[]): Promise<ComponentEntry[]> {
    return Promise.all(
      entries.map(async (entry) => {
        const owner = this.#owners.get(entry.id);
        const exposed = owner === undefined ? [] : await exposedOf(owner);

        return exposed.length === 0
          ? entry
          : {
              ...entry,
              exposed,
            };
      }),
    );
  }

  /** The components and sets of every page, or of `within`. */
  async addLocal(within: string | undefined): Promise<void> {
    const roots = within === undefined ? [...figma.root.children] : [await requireNode(within)];

    for (const root of roots) {
      if (this.#late()) {
        this.cut = true;
        break;
      }

      try {
        await loaded(root);
      } catch (error) {
        // A page Figma cannot fetch (offline, say) is left out; the other pages are still read.
        this.pagesNotRead.push({
          name: root.name,
          error: errorMessage(error),
        });
        continue;
      }

      for (const node of [root, ...descendants(root, ["COMPONENT_SET", "COMPONENT"])]) {
        if (node.type === "COMPONENT_SET" || (node.type === "COMPONENT" && node.parent?.type !== "COMPONENT_SET")) {
          this.#found.set(node.id, componentEntryOf(node as ComponentOwner));
          this.#owners.set(node.id, node as ComponentOwner);
        }
      }
    }
  }

  /** The components the instances on the current page, or in `within`, come from, counted. */
  async addUsed(within: string | undefined): Promise<void> {
    const root = within === undefined ? figma.currentPage : await requireNode(within);

    await loaded(root);

    const instances = [root, ...descendants(root, ["INSTANCE"])].filter(
      (node): node is InstanceNode => node.type === "INSTANCE",
    );

    for (let index = 0; index < instances.length; index += MAIN_COMPONENT_BATCH) {
      if (this.#late()) {
        this.cut = true;
        break;
      }

      const batch = instances.slice(index, index + MAIN_COMPONENT_BATCH);
      const mains = await Promise.all(batch.map((instance) => instance.getMainComponentAsync()));

      mains.forEach((main, at) => {
        const instance = batch[at];

        if (main !== null && instance !== undefined) {
          this.#count(main.parent?.type === "COMPONENT_SET" ? main.parent : main, instance);
        }
      });
    }
  }

  #count(owner: ComponentOwner, instance: InstanceNode): void {
    const entry = this.#found.get(owner.id) ?? componentEntryOf(owner);

    this.#found.set(owner.id, {
      ...entry,
      instances: (entry.instances ?? 0) + 1,
    });
    this.#owners.set(owner.id, owner);

    if (!this.#instances.has(owner.id)) {
      this.#instances.set(owner.id, instance);
    }
  }

  #late(): boolean {
    return Date.now() - this.started > OP_BUDGET_MS;
  }
}

/** The layers of these types inside a node (a page, a frame, a set), not the node itself. */
function descendants(node: BaseNode, types: NodeType[]): BaseNode[] {
  return "findAllWithCriteria" in node ? node.findAllWithCriteria({ types }) : [];
}

/** dynamic-page: a page the user is not on has no layers until it is loaded. */
async function loaded(node: BaseNode): Promise<void> {
  if (node.type === "PAGE" && node !== figma.currentPage) {
    await node.loadAsync();
  }
}
