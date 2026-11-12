import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TimeoutError } from "p-timeout";
import { DEV_LINKS } from "@/plugin/adapters/figma/dev-resources/dev-resources.constants.ts";
import { DEV_RESOURCES } from "@/plugin/adapters/figma/dev-resources/dev-resources.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { COMPONENT_LINKS_TEXT } from "@/plugin/operations/components/components.constants.ts";
import type { FoundComponents } from "@/plugin/operations/components/components.types.ts";
import { COMPONENT_TYPE } from "@/shared/ops/components/components.constants.ts";
import type { ComponentEntry, ComponentLink } from "@/shared/ops/components/components.schema.ts";

/** The listed components with their links, and why some or all were not read. */
export interface Linked {
  readonly entries: ComponentEntry[];
  readonly note?: string;
}

/**
 * The listed components' Dev Mode links (T-192, P-124): the file is asked first, since a plan without them refuses that
 * (FX-065); then each component's, a batch at a time until the op's deadline. Figma refusing, not answering or the time
 * running out is the note, never an error.
 */
@injectable()
export class ComponentLinks {
  readonly #resources;
  readonly #walk;

  constructor(resources = inject(DEV_RESOURCES), walk = inject(LAYER_WALK)) {
    this.#resources = resources;
    this.#walk = walk;
  }

  async linked(entries: readonly ComponentEntry[], found: FoundComponents): Promise<Linked> {
    try {
      const refusal = await this.#resources.refusal();

      return refusal === null
        ? await this.#read(entries, found)
        : { entries: [...entries], note: COMPONENT_LINKS_TEXT.refused(refusal) };
    } catch (error) {
      return { entries: [...entries], note: this.#failure(error) };
    }
  }

  /** Each entry's links, batch by batch; past the deadline the rest are left without, with a note. */
  async #read(entries: readonly ComponentEntry[], found: FoundComponents): Promise<Linked> {
    const links = new Map<string, ComponentLink[]>();
    const cut = await this.#walk.lookUp(entries, found.deadline, {
      lookup: (entry) => this.#of(entry, found),
      take: (entry, read) => {
        links.set(entry.id, read);
      },
      enough: () => false,
    });

    return {
      entries: entries.map((entry) => {
        const read = links.get(entry.id);

        return read === undefined ? entry : { ...entry, links: read };
      }),
      ...(cut ? { note: COMPONENT_LINKS_TEXT.partly(links.size) } : {}),
    };
  }

  /** A component's own links, a set's with its variants' (naming the variant); a library's through an instance. */
  async #of(entry: ComponentEntry, found: FoundComponents): Promise<ComponentLink[]> {
    const owner = found.owners.get(entry.id);

    if (entry.remote) {
      return this.#inherited(found.instances.get(entry.id));
    }

    if (owner === undefined) {
      return [];
    }

    const set = owner.type === COMPONENT_TYPE.set;
    const variants = new Map(set ? owner.children.map((child) => [child.id, child.name] as const) : []);
    const attached = await this.#resources.of(owner, set);

    return attached.flatMap(({ name, url, nodeId, inheritedNodeId }) => {
      const on = variants.get(nodeId);

      if (inheritedNodeId !== undefined || (nodeId !== owner.id && on === undefined)) {
        return [];
      }

      return [{ name, url, ...(on === undefined ? {} : { on }) }];
    });
  }

  /** A library component's links, as its instance inherits them; none without an instance. */
  async #inherited(instance: InstanceNode | undefined): Promise<ComponentLink[]> {
    if (instance === undefined) {
      return [];
    }

    const attached = await this.#resources.of(instance, false);

    return attached
      .filter(({ inheritedNodeId }) => inheritedNodeId !== undefined)
      .map(({ name, url }) => ({ name, url }));
  }

  #failure(error: unknown): string {
    if (error instanceof TimeoutError) {
      return COMPONENT_LINKS_TEXT.timedOut(DEV_LINKS.timeoutMs);
    }

    return COMPONENT_LINKS_TEXT.failed(error instanceof Error ? error.message : String(error));
  }
}

export const COMPONENT_LINKS = new InjectionToken<ComponentLinks>("ComponentLinks");
