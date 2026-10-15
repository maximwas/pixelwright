import { closest } from "@pixelwright/core";
import { type ComponentOwner, ownerOf } from "./variants.ts";
import { WriteError } from "./write-error.ts";

/**
 * Components by the names design_read writes (a set's, a lone component's), or `key:<key>` for a library's, looked up
 * as needed: those made in this call, those the current page's instances come from (a library's among them), then the
 * file's own on every page (loaded once), then a library's by key.
 */
export class ComponentIndex {
  readonly #made = new Map<string, ComponentOwner>();
  #used: Map<string, ComponentOwner> | null = null;
  #local: Map<string, ComponentOwner> | null = null;

  /** A component or set made in this call, so a later instance finds it. */
  add(owner: ComponentOwner): void {
    this.#made.set(owner.name, owner);
  }

  async find(name: string): Promise<ComponentOwner> {
    if (name.startsWith("key:")) {
      const key = name.slice(4);

      return await figma.importComponentSetByKeyAsync(key).catch(() => figma.importComponentByKeyAsync(key));
    }

    this.#used ??= await usedOwners();

    const found = this.#made.get(name) ?? this.#used.get(name);

    if (found !== undefined) {
      return found;
    }

    this.#local ??= await localOwners();

    const own = this.#local.get(name);

    if (own !== undefined) {
      return own;
    }

    throw notFound(name, [...this.#made.keys(), ...this.#used.keys(), ...this.#local.keys()]);
  }
}

function notFound(name: string, known: readonly string[]): WriteError {
  const near = closest(name, new Set(known));

  return new WriteError(
    `No component or component set is named ${name} in this file or the libraries its page uses.`,
    near === null
      ? 'components_read lists them; a library one the file does not use yet takes component="key:<key>".'
      : `Did you mean ${near}?`,
  );
}

async function usedOwners(): Promise<Map<string, ComponentOwner>> {
  const owners = new Map<string, ComponentOwner>();

  for (const instance of figma.currentPage.findAllWithCriteria({ types: ["INSTANCE"] })) {
    const main = await instance.getMainComponentAsync();
    const owner = main === null ? null : ownerOf(main);

    if (owner !== null && !owners.has(owner.name)) {
      owners.set(owner.name, owner);
    }
  }

  return owners;
}

async function localOwners(): Promise<Map<string, ComponentOwner>> {
  await figma.loadAllPagesAsync();

  const owners = new Map<string, ComponentOwner>();

  for (const node of figma.root.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })) {
    if ((node.type === "COMPONENT_SET" || node.parent?.type !== "COMPONENT_SET") && !owners.has(node.name)) {
      owners.set(node.name, node);
    }
  }

  return owners;
}
