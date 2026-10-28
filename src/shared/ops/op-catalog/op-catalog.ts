import type { AnyOpContract } from "@/shared/ops/op-contract/op-contract.types.ts";

/** Every op's contract by name, in a fixed order (Registry, A§5.5): the runner looks ops up here, the golden lists it. */
export class OpCatalog {
  readonly #contracts: ReadonlyMap<string, AnyOpContract>;

  constructor(contracts: readonly AnyOpContract[]) {
    this.#contracts = new Map(contracts.map((contract) => [contract.name, contract]));
  }

  find(name: string): AnyOpContract | undefined {
    return this.#contracts.get(name);
  }

  all(): AnyOpContract[] {
    return [...this.#contracts.values()];
  }
}
