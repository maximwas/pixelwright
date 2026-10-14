import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { MAIN_COMPONENT_BATCH, OP_BUDGET_MS } from "../../constants/plugin.ts";
import { requireNode } from "../../figma/nodes.ts";
import { type ComponentEntry, type ComponentOwner, componentEntryOf } from "./component-entry.ts";

/**
 * The file's own components (every page, loaded one at a time) or the ones the instances in a layer come from, local
 * or from a library; `within` itself counts. A variant is listed under its set; properties are read from the set, never
 * from a variant, where Figma throws. A big file answers within OP_BUDGET_MS with what it has and more: true.
 */
export async function components({
  scope,
  within,
  query,
  limit,
}: OperationInput<"components">): Promise<OperationOutput<"components">> {
  const found = new FoundComponents();

  await (scope === "local" ? found.addLocal(within) : found.addUsed(within));

  const wanted = query?.toLowerCase();
  const matching = found.entries().filter((entry) => wanted === undefined || entry.name.toLowerCase().includes(wanted));

  return {
    components: matching.slice(0, limit),
    more: found.cut || matching.length > limit,
  };
}

/** The components found by id, and whether the time ran out first. */
class FoundComponents {
  cut = false;
  readonly #found = new Map<string, ComponentEntry>();
  readonly #started = Date.now();

  entries(): ComponentEntry[] {
    return [...this.#found.values()];
  }

  /** The components and sets of every page, or of `within`. */
  async addLocal(within: string | undefined): Promise<void> {
    const roots = within === undefined ? [...figma.root.children] : [await requireNode(within)];

    for (const root of roots) {
      if (this.#late()) {
        this.cut = true;
        break;
      }

      await loaded(root);

      for (const node of [root, ...descendants(root, ["COMPONENT_SET", "COMPONENT"])]) {
        if (node.type === "COMPONENT_SET" || (node.type === "COMPONENT" && node.parent?.type !== "COMPONENT_SET")) {
          this.#found.set(node.id, componentEntryOf(node as ComponentOwner));
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

      const mains = await Promise.all(
        instances.slice(index, index + MAIN_COMPONENT_BATCH).map((instance) => instance.getMainComponentAsync()),
      );

      for (const main of mains) {
        if (main !== null) {
          this.#count(main.parent?.type === "COMPONENT_SET" ? main.parent : main);
        }
      }
    }
  }

  #count(owner: ComponentOwner): void {
    const entry = this.#found.get(owner.id) ?? componentEntryOf(owner);

    this.#found.set(owner.id, {
      ...entry,
      instances: (entry.instances ?? 0) + 1,
    });
  }

  #late(): boolean {
    return Date.now() - this.#started > OP_BUDGET_MS;
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
