import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PROPERTY_NAME } from "@/plugin/operations/components/components.constants.ts";
import type { ComponentOwner } from "@/plugin/operations/components/components.types.ts";
import { COMPONENT_TYPE } from "@/shared/ops/components/components.constants.ts";
import type { ComponentEntry, PropertyDefinitions } from "@/shared/ops/components/components.schema.ts";

/**
 * A component or set as the components op lists it (T-190): where it is, its variants, and its properties' definitions,
 * read from the set or a lone component only, since Figma throws on a variant's (FX-028).
 */
@injectable()
export class ComponentEntries {
  readonly #lookup;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  entry(owner: ComponentOwner): ComponentEntry {
    const base = {
      id: owner.id,
      key: owner.key,
      type: owner.type,
      name: owner.name,
      page: this.#lookup.pageOf(owner)?.name ?? null,
      remote: owner.remote,
      ...(owner.description === "" ? {} : { description: owner.description }),
      ...(owner.type === COMPONENT_TYPE.set
        ? { variants: this.variants(owner).map(({ id, name }) => ({ id, name })) }
        : {}),
    };

    try {
      return { ...base, properties: this.properties(owner.componentPropertyDefinitions) };
    } catch (error) {
      // Figma refuses the definitions of a set with variant conflicts: the set is still listed, with why.
      return { ...base, properties: {}, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** What lists a main component: its set when it is a variant, never the variant (FX-028). */
  owner(main: ComponentNode): ComponentOwner {
    return main.parent?.type === COMPONENT_TYPE.set ? main.parent : main;
  }

  variants(set: ComponentSetNode): ComponentNode[] {
    return set.children.filter((child): child is ComponentNode => child.type === COMPONENT_TYPE.component);
  }

  /**
   * The definitions by the names Figma shows; an instance's values, when given, are the defaults (as set inside a
   * component). A slot has no default (B-060).
   */
  properties(definitions: ComponentPropertyDefinitions, values: ComponentProperties = {}): PropertyDefinitions {
    return Object.fromEntries(
      Object.entries(definitions).map(([name, definition]) => {
        const value = values[name]?.value;
        const given = typeof value === "string" || typeof value === "boolean" ? value : definition.defaultValue;

        return [
          name.replace(PROPERTY_NAME.idSuffix, ""),
          {
            type: definition.type,
            ...(given === undefined ? {} : { default: given }),
            ...(definition.variantOptions === undefined ? {} : { options: [...definition.variantOptions] }),
          },
        ];
      }),
    );
  }
}

export const COMPONENT_ENTRIES = new InjectionToken<ComponentEntries>("ComponentEntries");
