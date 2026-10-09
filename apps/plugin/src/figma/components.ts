import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { MAIN_COMPONENT_BATCH, OP_BUDGET_MS } from "../constants/plugin.ts";
import { errorMessage } from "../utils/error-message.ts";
import { pageOf, requireNode } from "./nodes.ts";

type Entry = OperationOutput<"components">["components"][number];
type Owner = ComponentNode | ComponentSetNode;

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
  const found = new Map<string, Entry>();
  const started = Date.now();
  const late = () => Date.now() - started > OP_BUDGET_MS;
  let cut = false;

  if (scope === "local") {
    const roots = within === undefined ? [...figma.root.children] : [await requireNode(within)];

    for (const root of roots) {
      if (late()) {
        cut = true;
        break;
      }

      await loaded(root);

      for (const node of [root, ...descendants(root, ["COMPONENT_SET", "COMPONENT"])]) {
        if (node.type === "COMPONENT_SET" || (node.type === "COMPONENT" && node.parent?.type !== "COMPONENT_SET")) {
          found.set(node.id, entryOf(node as Owner));
        }
      }
    }
  } else {
    const root = within === undefined ? figma.currentPage : await requireNode(within);

    await loaded(root);

    const instances = [root, ...descendants(root, ["INSTANCE"])].filter(
      (node): node is InstanceNode => node.type === "INSTANCE",
    );

    for (let index = 0; index < instances.length; index += MAIN_COMPONENT_BATCH) {
      if (late()) {
        cut = true;
        break;
      }

      const mains = await Promise.all(
        instances.slice(index, index + MAIN_COMPONENT_BATCH).map((instance) => instance.getMainComponentAsync()),
      );

      for (const main of mains) {
        if (main !== null) {
          const owner: Owner = main.parent?.type === "COMPONENT_SET" ? main.parent : main;
          const entry = found.get(owner.id) ?? entryOf(owner);

          found.set(owner.id, {
            ...entry,
            instances: (entry.instances ?? 0) + 1,
          });
        }
      }
    }
  }

  const wanted = query?.toLowerCase();
  const matching = [...found.values()].filter(
    (entry) => wanted === undefined || entry.name.toLowerCase().includes(wanted),
  );

  return {
    components: matching.slice(0, limit),
    more: cut || matching.length > limit,
  };
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

function entryOf(owner: Owner): Entry {
  const base = {
    id: owner.id,
    key: owner.key,
    type: owner.type,
    name: owner.name,
    page: pageOf(owner)?.name ?? null,
    remote: owner.remote,
    ...(owner.description === "" || owner.description === undefined ? {} : { description: owner.description }),
    ...(owner.type === "COMPONENT_SET"
      ? {
          variants: owner.children
            .filter((child) => child.type === "COMPONENT")
            .map((variant) => ({
              id: variant.id,
              name: variant.name,
            })),
        }
      : {}),
  };

  try {
    return {
      ...base,
      properties: propertiesOf(owner.componentPropertyDefinitions),
    };
  } catch (error) {
    // Figma refuses the definitions of a set with variant conflicts; the set is still listed, with why.
    return {
      ...base,
      properties: {},
      error: errorMessage(error),
    };
  }
}

function propertiesOf(definitions: ComponentPropertyDefinitions): Entry["properties"] {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [
      // Figma suffixes a non-variant property's name with its id: "Label#12:0".
      name.replace(/#[^#]*$/, ""),
      {
        type: definition.type,
        default: definition.defaultValue,
        ...(definition.variantOptions === undefined ? {} : { options: [...definition.variantOptions] }),
      },
    ]),
  );
}
