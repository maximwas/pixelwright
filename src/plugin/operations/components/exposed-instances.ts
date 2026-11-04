import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { COMPONENT_ENTRIES } from "@/plugin/operations/components/component-entries.ts";
import { EXPOSED_KEY } from "@/plugin/operations/components/components.constants.ts";
import type { ComponentOwner } from "@/plugin/operations/components/components.types.ts";
import { COMPONENT_TYPE } from "@/shared/ops/components/components.constants.ts";
import type { ExposedInstance, PropertyDefinitions } from "@/shared/ops/components/components.schema.ts";

/** One exposed instance of a set, and the variants that expose one like it. */
interface Combined {
  readonly entry: ExposedInstance;
  readonly variants: Set<string>;
}

/**
 * The nested instances a component exposes (isExposedInstance, T-190), found without entering other instances: a set's
 * combined across its variants by layer name and component, with the variants that expose one when not all do.
 */
@injectable()
export class ExposedInstances {
  readonly #entries;

  constructor(entries = inject(COMPONENT_ENTRIES)) {
    this.#entries = entries;
  }

  async of(owner: ComponentOwner): Promise<ExposedInstance[]> {
    if (owner.type === COMPONENT_TYPE.component) {
      return Promise.all(this.#under(owner).map((instance) => this.#entry(instance)));
    }

    const variants = this.#entries.variants(owner);
    const combined = new Map<string, Combined>();

    for (const variant of variants) {
      for (const instance of this.#under(variant)) {
        const entry = await this.#entry(instance);
        const key = EXPOSED_KEY.of(entry.name, entry.component);
        const found = combined.get(key) ?? { entry, variants: new Set<string>() };

        // A variant exposing two such layers is still one variant.
        found.variants.add(variant.name);
        combined.set(key, found);
      }
    }

    return [...combined.values()].map(({ entry, variants: exposing }) =>
      exposing.size === variants.length ? entry : { ...entry, variants: [...exposing] },
    );
  }

  /** The exposed instances under a layer, in layer order; another instance is never entered. */
  #under(node: BaseNode): InstanceNode[] {
    if (!("children" in node)) {
      return [];
    }

    return node.children.flatMap((child) => {
      if (child.type !== FIGMA_NODE_TYPE.instance) {
        return this.#under(child);
      }

      return child.isExposedInstance ? [child] : [];
    });
  }

  /** An exposed instance with its set's (or component's) name, key and properties, its values as the defaults. */
  async #entry(instance: InstanceNode): Promise<ExposedInstance> {
    const main = await instance.getMainComponentAsync();
    const owner = main === null ? null : this.#entries.owner(main);

    return {
      id: instance.id,
      name: instance.name,
      component: owner?.name ?? instance.name,
      key: owner?.key ?? "",
      properties: owner === null ? {} : this.#defined(owner, instance.componentProperties),
    };
  }

  /** The definitions with an instance's values; none where Figma refuses them (variant conflicts, FX-028). */
  #defined(owner: ComponentOwner, values: ComponentProperties): PropertyDefinitions {
    try {
      return this.#entries.properties(owner.componentPropertyDefinitions, values);
    } catch {
      return {};
    }
  }
}

export const EXPOSED_INSTANCES = new InjectionToken<ExposedInstances>("ExposedInstances");
