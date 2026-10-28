import { ownStyles } from "./styles.ts";

/**
 * Variables, their collections and styles by id for one call: the file's own read once from Figma's lists, which it
 * answers offline too (a lookup by id waits ten seconds and fails then, even for the file's own); a library's asked
 * for by id once each, and null when Figma cannot reach it. A variable the call makes is found as soon as it is made.
 */
export class IdLookup {
  #collections: Promise<Map<string, VariableCollection>> | null = null;
  #variables: Promise<Map<string, Variable>> | null = null;
  #styles: Promise<Map<string, BaseStyle>> | null = null;
  readonly #made = new Map<string, Variable>();
  readonly #asked = new Map<string, Promise<unknown>>();

  async collection(id: string): Promise<VariableCollection | null> {
    this.#collections ??= figma.variables.getLocalVariableCollectionsAsync().then(byId);

    return (
      (await this.#collections).get(id) ??
      (await this.#ask(`collection ${id}`, () => figma.variables.getVariableCollectionByIdAsync(id)))
    );
  }

  async variable(id: string): Promise<Variable | null> {
    this.#variables ??= figma.variables.getLocalVariablesAsync().then(byId);

    return (
      this.#made.get(id) ??
      (await this.#variables).get(id) ??
      (await this.#ask(`variable ${id}`, () => figma.variables.getVariableByIdAsync(id)))
    );
  }

  async style(id: string): Promise<BaseStyle | null> {
    this.#styles ??= ownStyles().then(byId);

    return (await this.#styles).get(id) ?? (await this.#ask(`style ${id}`, () => figma.getStyleByIdAsync(id)));
  }

  /** A variable the call made: found from now on without Figma's lists, which were read before it existed. */
  remember(variable: Variable): void {
    this.#made.set(variable.id, variable);
  }

  /** Figma's lookup by id, once per id; what it cannot reach is null. */
  async #ask<T>(key: string, lookup: () => Promise<T | null>): Promise<T | null> {
    let asked = this.#asked.get(key) as Promise<T | null> | undefined;

    if (asked === undefined) {
      asked = lookup().catch(() => null);
      this.#asked.set(key, asked);
    }

    return await asked;
  }
}

function byId<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
