import { InjectionToken, inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import { Closest } from "@/core/kernel/names/closest.ts";
import {
  COMPONENT_LIMIT,
  COMPONENT_TEXT,
  COMPONENT_VALUE,
} from "@/plugin/adapters/figma/components/components.constants.ts";
import type { ComponentOwner } from "@/plugin/adapters/figma/components/components.types.ts";
import { VARIANTS } from "@/plugin/adapters/figma/components/variants.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

/**
 * Components by the names design_read writes (a set's, a lone component's), or `key:<key>` for a library's (P-083),
 * looked up as a call needs them: those it made, those the current page's instances come from (a library's among
 * them), the file's own on every page (loaded once), then a library's by key. One call's, started again by the next.
 */
@injectable()
export class ComponentIndex {
  readonly #closest = new Closest();
  readonly #planned = new Set<string>();
  readonly #made = new Map<string, ComponentOwner>();
  readonly #used = new Map<string, ComponentOwner>();
  readonly #local = new Map<string, ComponentOwner>();
  readonly #imported = new Map<string, ComponentOwner>();
  readonly #variants;
  #usedRead = false;
  #localRead = false;

  constructor(variants = inject(VARIANTS)) {
    this.#variants = variants;
  }

  /** A call's start: the names of the components and sets its XML makes, nothing the last call found. */
  start(planned: readonly string[]): void {
    for (const found of [this.#planned, this.#made, this.#used, this.#local, this.#imported]) {
      found.clear();
    }

    for (const name of planned) {
      this.#planned.add(name);
    }

    this.#usedRead = false;
    this.#localRead = false;
  }

  /** Whether the call makes a component or set of this name: a dry run, which makes none, cannot look it up. */
  planned(name: string): boolean {
    return this.#planned.has(name);
  }

  /** A component or set made in this call, so a later instance finds it first. */
  add(owner: ComponentOwner): void {
    this.#made.set(owner.name, owner);
  }

  async find(name: string): Promise<ComponentOwner> {
    if (name.startsWith(COMPONENT_VALUE.keyPrefix)) {
      return await this.#import(name.slice(COMPONENT_VALUE.keyPrefix.length));
    }

    await this.#readUsed();

    const found = this.#made.get(name) ?? this.#used.get(name);

    if (found !== undefined) {
      return found;
    }

    await this.#readLocal();

    const own = this.#local.get(name);

    if (own === undefined) {
      const near = this.#closest.of(name, [...this.#made.keys(), ...this.#used.keys(), ...this.#local.keys()]);

      throw new WriteError(
        COMPONENT_TEXT.notFound(name),
        near === null ? COMPONENT_TEXT.notFoundHint : COMPONENT_TEXT.near(near),
      );
    }

    return own;
  }

  /** The component an instance of this name and variant is made of. */
  async component(name: string, variant: Readonly<Record<string, string>>): Promise<ComponentNode> {
    return this.#variants.of(await this.find(name), variant);
  }

  /**
   * A library's set or lone component by key, both asked at once: Figma never answers a set import of a key that is no
   * published set (a lone component's among them), so the one that answers wins, within 10 s (FX-017).
   */
  async #import(key: string): Promise<ComponentOwner> {
    const known = this.#imported.get(key);

    if (known !== undefined) {
      return known;
    }

    const seconds = COMPONENT_LIMIT.keyImportMs / COMPONENT_LIMIT.msPerSecond;

    try {
      const owner = await pTimeout(
        Promise.any<ComponentOwner>([figma.importComponentSetByKeyAsync(key), figma.importComponentByKeyAsync(key)]),
        {
          milliseconds: COMPONENT_LIMIT.keyImportMs,
          message: this.#notImported(key, COMPONENT_TEXT.noAnswer(seconds)),
        },
      );

      this.#imported.set(key, owner);

      return owner;
    } catch (error) {
      if (!(error instanceof AggregateError)) {
        throw error;
      }

      const last: unknown = error.errors[error.errors.length - 1];

      throw this.#notImported(key, last instanceof Error ? last.message : String(last));
    }
  }

  #notImported(key: string, why: string): WriteError {
    return new WriteError(COMPONENT_TEXT.notImported(key, why), COMPONENT_TEXT.notImportedHint);
  }

  /** The sets and lone components the current page's instances come from, once a call. */
  async #readUsed(): Promise<void> {
    if (this.#usedRead) {
      return;
    }

    const instances = figma.currentPage.findAllWithCriteria({ types: [FIGMA_NODE_TYPE.instance] });

    for (const main of await Promise.all(instances.map(async (instance) => await instance.getMainComponentAsync()))) {
      const owner = main === null ? null : this.#variants.owner(main);

      if (owner !== null && !this.#used.has(owner.name)) {
        this.#used.set(owner.name, owner);
      }
    }

    this.#usedRead = true;
  }

  /** The file's own sets and lone components on every page, once a call. */
  async #readLocal(): Promise<void> {
    if (this.#localRead) {
      return;
    }

    await figma.loadAllPagesAsync();

    const types = [FIGMA_NODE_TYPE.componentSet, FIGMA_NODE_TYPE.component];

    for (const node of figma.root.findAllWithCriteria({ types })) {
      const lone = node.type === FIGMA_NODE_TYPE.componentSet || node.parent?.type !== FIGMA_NODE_TYPE.componentSet;

      if (lone && !this.#local.has(node.name)) {
        this.#local.set(node.name, node);
      }
    }

    this.#localRead = true;
  }
}

export const COMPONENT_INDEX = new InjectionToken<ComponentIndex>("ComponentIndex");
