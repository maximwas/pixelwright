import type { LayerEntry } from "../layer-entry.ts";

/** An instance's main component (and set, with its key), whether it is exposed, and its component properties' values. */
export async function readInstance(entry: LayerEntry): Promise<void> {
  if (entry.node.type !== "INSTANCE") {
    return;
  }

  const instance = await instanceOf(entry.node);

  if (instance !== null) {
    entry.set("instance", instance);
  }
}

async function instanceOf(node: InstanceNode): Promise<Record<string, unknown> | null> {
  const main = await node.getMainComponentAsync();

  if (main === null) {
    return null;
  }

  const set = main.parent?.type === "COMPONENT_SET" ? main.parent : null;

  return {
    componentId: main.id,
    componentName: main.name,
    componentKey: main.key,
    ...(main.remote ? { remote: true } : {}),
    ...(set === null
      ? {}
      : {
          setId: set.id,
          setName: set.name,
          ...(typeof set.key === "string" ? { setKey: set.key } : {}),
        }),
    // Only where Figma has it: an older Figma, or the fake, leaves it out.
    ...(node.isExposedInstance ? { exposed: true } : {}),
    // A slot's property has no value: the slot's own layers, read as its children, say what it holds.
    properties: Object.fromEntries(
      Object.entries(node.componentProperties).flatMap(([name, property]) =>
        typeof property.value === "string" || typeof property.value === "boolean"
          ? [
              [
                name,
                {
                  type: property.type,
                  value: property.value,
                },
              ],
            ]
          : [],
      ),
    ),
  };
}
