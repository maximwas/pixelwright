import type { ComponentEntry, ComponentOwner } from "./component-entry.ts";
import { propertiesOf } from "./component-entry.ts";

type Exposed = NonNullable<ComponentEntry["exposed"]>[number];

/**
 * The nested instances a component exposes (isExposedInstance), found without entering other instances: a set's
 * combined across its variants by layer name and component, with the variants that expose one when not all do.
 */
export async function exposedOf(owner: ComponentOwner): Promise<Exposed[]> {
  if (owner.type === "COMPONENT") {
    return Promise.all(exposedIn(owner).map((instance) => exposedEntryOf(instance)));
  }

  const variants = owner.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  const combined = new Map<string, { entry: Exposed; variants: Set<string> }>();

  for (const variant of variants) {
    for (const instance of exposedIn(variant)) {
      const entry = await exposedEntryOf(instance);
      const key = `${entry.name}\n${entry.component}`;
      const found = combined.get(key) ?? {
        entry,
        variants: new Set<string>(),
      };

      // A variant exposing two such layers is still one variant.
      found.variants.add(variant.name);
      combined.set(key, found);
    }
  }

  return [...combined.values()].map(({ entry, variants: exposing }) =>
    exposing.size === variants.length
      ? entry
      : {
          ...entry,
          variants: [...exposing],
        },
  );
}

/** The exposed instances under a layer, in layer order; another instance is never entered. */
function exposedIn(node: BaseNode): InstanceNode[] {
  if (!("children" in node)) {
    return [];
  }

  return node.children.flatMap((child) => {
    if (child.type === "INSTANCE") {
      return child.isExposedInstance ? [child] : [];
    }

    return exposedIn(child);
  });
}

/** An exposed instance with its set's (or component's) name, key and properties, its values inside the component as defaults. */
async function exposedEntryOf(instance: InstanceNode): Promise<Exposed> {
  const main = await instance.getMainComponentAsync();
  const owner = main?.parent?.type === "COMPONENT_SET" ? main.parent : main;

  return {
    id: instance.id,
    name: instance.name,
    component: owner?.name ?? instance.name,
    key: owner?.key ?? "",
    properties: owner === null ? {} : definedProperties(owner, instance.componentProperties),
  };
}

/** A set's or component's definitions, with an instance's values; none where Figma refuses them (variant conflicts). */
function definedProperties(owner: ComponentOwner, values: ComponentProperties): Exposed["properties"] {
  try {
    return propertiesOf(owner.componentPropertyDefinitions, values);
  } catch {
    return {};
  }
}
