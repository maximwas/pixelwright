import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { COMPONENT_ENTRIES } from "@/plugin/operations/components/component-entries.ts";
import { COMPONENT_DETAILS_TEXT, PROPERTY_NAME } from "@/plugin/operations/components/components.constants.ts";
import type { ComponentOwner } from "@/plugin/operations/components/components.types.ts";
import { EXPOSED_INSTANCES } from "@/plugin/operations/components/exposed-instances.ts";
import { COMPONENT_TYPE, COMPONENTS } from "@/shared/ops/components/components.constants.ts";
import type { ComponentEntry, PropertyReference } from "@/shared/ops/components/components.schema.ts";

/** What a components call asks for past the entries themselves. */
export interface DetailsAsked {
  readonly instances?: boolean;
  readonly references?: boolean;
}

/**
 * What a listed component carries past its entry (T-190): the nested instances it exposes; asked for, its instances
 * with their pages, and per property the layers bound to it.
 */
@injectable()
export class ComponentDetails {
  readonly #entries;
  readonly #exposed;
  readonly #lookup;

  constructor(
    entries = inject(COMPONENT_ENTRIES),
    exposed = inject(EXPOSED_INSTANCES),
    lookup = inject(NODE_LOOKUP),
  ) {
    this.#entries = entries;
    this.#exposed = exposed;
    this.#lookup = lookup;
  }

  async of(
    entry: ComponentEntry,
    owner: ComponentOwner | undefined,
    asked: DetailsAsked,
  ): Promise<ComponentEntry> {
    if (owner === undefined) {
      return entry;
    }

    const exposed = await this.#exposed.of(owner);

    const instances = (asked.instances ?? false) ? await this.#instances(owner) : {};
    const references = (asked.references ?? false) ? this.#references(owner) : {};
    const errors = [entry.error, instances.error, references.error].filter((error) => error !== undefined);

    return {
      ...entry,
      ...(exposed.length === 0 ? {} : { exposed }),
      ...instances,
      ...references,
      ...(errors.length === 0 ? {} : { error: errors.join(COMPONENT_DETAILS_TEXT.separator) }),
    };
  }

  /** The component's instances, a set's of every variant, at most COMPONENTS.instancesCap, each with its page. */
  async #instances(owner: ComponentOwner): Promise<Pick<ComponentEntry, "instanceNodes" | "instanceNodesMore" | "error">> {
    const mains = owner.type === COMPONENT_TYPE.set ? this.#entries.variants(owner) : [owner];
    let failed = false;
    // A remote or unloadable component rejects: it lists none, and the entry says so, instead of failing the call.
    const lists = await Promise.all(
      mains.map((main) =>
        main.getInstancesAsync().catch(() => {
          failed = true;

          return [];
        }),
      ),
    );
    const found = lists.flat();

    return {
      instanceNodes: found
        .slice(0, COMPONENTS.instancesCap)
        .map((instance) => ({
          id: instance.id,
          name: instance.name,
          page: this.#lookup.pageOf(instance)?.name ?? null,
        })),
      ...(found.length > COMPONENTS.instancesCap ? { instanceNodesMore: true as const } : {}),
      ...(failed ? { error: COMPONENT_DETAILS_TEXT.instancesFailed } : {}),
    };
  }

  /**
   * Per property by the name Figma shows, the layers inside the component bound to it (componentPropertyReferences);
   * a nested instance's own properties are not the component's, so only its definitions' keys count.
   */
  #references(owner: ComponentOwner): Pick<ComponentEntry, "references" | "error"> {
    try {
      return { references: this.#bound(owner) };
    } catch {
      return { error: COMPONENT_DETAILS_TEXT.referencesFailed };
    }
  }

  #bound(owner: ComponentOwner): Record<string, PropertyReference[]> {
    const keys = new Set(Object.keys(this.#definitions(owner)));
    const bound: Record<string, PropertyReference[]> = {};

    for (const node of owner.findAll((node) => "componentPropertyReferences" in node)) {
      const references = "componentPropertyReferences" in node ? (node.componentPropertyReferences ?? {}) : {};

      for (const [field, key] of Object.entries(references)) {
        if (keys.has(key)) {
          const name = key.replace(PROPERTY_NAME.idSuffix, "");

          bound[name] = [...(bound[name] ?? []), { id: node.id, name: node.name, field }];
        }
      }
    }

    return bound;
  }

  /** Figma refuses the definitions of a set with variant conflicts: it then has no properties to bind. */
  #definitions(owner: ComponentOwner): ComponentPropertyDefinitions {
    try {
      return owner.componentPropertyDefinitions;
    } catch {
      return {};
    }
  }
}

export const COMPONENT_DETAILS = new InjectionToken<ComponentDetails>("ComponentDetails");
