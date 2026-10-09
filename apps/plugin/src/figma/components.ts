import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { pageOf, requireNode } from "./nodes.ts";

type Entry = OperationOutput<"components">["components"][number];
type Owner = ComponentNode | ComponentSetNode;

/**
 * The file's own components (every page, loaded one at a time) or the ones the instances in a layer come from, local
 * or from a library. A variant is listed under its set; properties are read from the set, never from a variant, where
 * Figma throws.
 */
export async function components({
  scope,
  within,
  query,
  limit,
}: OperationInput<"components">): Promise<OperationOutput<"components">> {
  const found = new Map<string, Entry>();

  if (scope === "local") {
    const roots = within === undefined ? [...figma.root.children] : [await requireNode(within)];

    for (const root of roots) {
      await loaded(root);

      if ("findAllWithCriteria" in root) {
        for (const node of root.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })) {
          if (node.type === "COMPONENT_SET" || node.parent?.type !== "COMPONENT_SET") {
            found.set(node.id, entryOf(node as Owner));
          }
        }
      }
    }
  } else {
    const root = within === undefined ? figma.currentPage : await requireNode(within);

    await loaded(root);

    for (const instance of "findAllWithCriteria" in root ? root.findAllWithCriteria({ types: ["INSTANCE"] }) : []) {
      const main = await (instance as InstanceNode).getMainComponentAsync();

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

  const wanted = query?.toLowerCase();
  const matching = [...found.values()].filter(
    (entry) => wanted === undefined || entry.name.toLowerCase().includes(wanted),
  );

  return {
    components: matching.slice(0, limit),
    more: matching.length > limit,
  };
}

/** dynamic-page: a page the user is not on has no layers until it is loaded. */
async function loaded(node: BaseNode): Promise<void> {
  if (node.type === "PAGE" && node !== figma.currentPage) {
    await node.loadAsync();
  }
}

function entryOf(owner: Owner): Entry {
  const definitions = owner.componentPropertyDefinitions;

  return {
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
    properties: Object.fromEntries(
      Object.entries(definitions).map(([name, definition]) => [
        // Figma suffixes a non-variant property's name with its id: "Label#12:0".
        name.replace(/#[^#]*$/, ""),
        {
          type: definition.type,
          default: definition.defaultValue,
          ...(definition.variantOptions === undefined ? {} : { options: [...definition.variantOptions] }),
        },
      ]),
    ),
  };
}
