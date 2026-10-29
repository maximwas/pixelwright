import { injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { INSTANCE_LAYER_ID } from "@/plugin/adapters/figma/layer-meta/layer-meta.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Instance = NonNullable<ReadLayer["instance"]>;

/**
 * What a layer is as a component's part: an instance's main component (its set, with the keys), whether it is
 * exposed, its properties' values; a component's description; the properties a component's layer (not a copy inside
 * an instance) is bound to; and
 * what the instances above it override on it (C-133), the fields a property carries left out. A slot's property has no
 * value and is left out (its layers are read as children); componentPropertyDefinitions, which throws on a variant
 * (FX-028), is never read.
 */
@injectable()
export class ComponentFieldReader implements FieldReader {
  async read(node: SceneNode): Promise<Partial<ReadLayer>> {
    const references = "componentPropertyReferences" in node ? (node.componentPropertyReferences ?? {}) : {};
    const instance = node.type === FIGMA_NODE_TYPE.instance ? await this.#instance(node) : null;
    const overrides = this.#overrides(node).filter((field) => !Object.hasOwn(references, field));
    // Inside an instance the bindings repeat per copy and the instance's props say them (m:482a605b).
    const bound = Object.keys(references).length > 0 && !node.id.startsWith(INSTANCE_LAYER_ID.prefix);

    return {
      ...(instance === null ? {} : { instance }),
      ...("description" in node && node.description !== "" ? { description: node.description } : {}),
      ...(bound ? { componentPropertyReferences: { ...references } } : {}),
      ...(overrides.length > 0 ? { overrides } : {}),
    };
  }

  async #instance(node: InstanceNode): Promise<Instance | null> {
    const main = await node.getMainComponentAsync();

    if (main === null) {
      return null;
    }

    const set = main.parent?.type === FIGMA_NODE_TYPE.componentSet ? main.parent : null;

    return {
      componentId: main.id,
      componentName: main.name,
      componentKey: main.key,
      ...(main.remote ? { remote: true } : {}),
      ...(set === null ? {} : { setId: set.id, setName: set.name, setKey: set.key }),
      ...(node.isExposedInstance ? { exposed: true as const } : {}),
      properties: Object.fromEntries(
        Object.entries(node.componentProperties).flatMap(([name, { type, value }]) =>
          typeof value === "string" || typeof value === "boolean" ? [[name, { type, value }]] : [],
        ),
      ),
    };
  }

  /** The fields the instances around the layer (itself included) override on it, each once. */
  #overrides(node: SceneNode): string[] {
    if (node.type !== FIGMA_NODE_TYPE.instance && !node.id.startsWith(INSTANCE_LAYER_ID.prefix)) {
      return [];
    }

    const fields: string[] = [];

    for (let current: BaseNode | null = node; current !== null; current = current.parent) {
      if (current.type === FIGMA_NODE_TYPE.instance) {
        fields.push(
          ...current.overrides.filter(({ id }) => id === node.id).flatMap(({ overriddenFields }) => overriddenFields),
        );
      }
    }

    return [...new Set(fields)];
  }
}
