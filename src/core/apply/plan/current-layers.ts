import type { LayerEntry } from "@/core/apply/plan/plan.types.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** The layers a call read, by id with their parents; the ids the file does not hold (the apply profile's answer). */
export class CurrentLayers {
  readonly #entries: ReadonlyMap<string, LayerEntry>;
  readonly #missing: ReadonlySet<string>;

  constructor(entries: ReadonlyMap<string, LayerEntry>, missing: ReadonlySet<string>) {
    this.#entries = entries;
    this.#missing = missing;
  }

  /** The apply reads: each root with its layers, by id; a root's parent is its first ancestor, none at its page. */
  static of(reads: readonly ReadModel[], missing: readonly string[]): CurrentLayers {
    const entries = new Map<string, LayerEntry>();

    for (const model of reads) {
      const page = model.page?.id;

      CurrentLayers.#index(
        { layer: model.root, parent: model.ancestors?.[0] ?? null, model, ...(page === undefined ? {} : { page }) },
        entries,
      );
    }

    return new CurrentLayers(entries, new Set(missing));
  }

  static #index(entry: LayerEntry, entries: Map<string, LayerEntry>): void {
    entries.set(entry.layer.id, entry);

    for (const child of entry.layer.children ?? []) {
      CurrentLayers.#index({ layer: child, parent: entry.layer, model: entry.model }, entries);
    }
  }

  entry(id: string): LayerEntry | undefined {
    return this.#entries.get(id);
  }

  /** Whether the file said it does not hold this id. */
  isMissing(id: string): boolean {
    return this.#missing.has(id);
  }
}
