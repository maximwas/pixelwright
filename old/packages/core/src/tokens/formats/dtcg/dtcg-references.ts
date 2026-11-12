import type { RawTokens } from "../../raw-tokens.ts";
import { pathOf, placements } from "./dtcg-paths.ts";

/**
 * Where every typed variable sits in its collection's trees and how an alias names it (`{color.brand}`,
 * `{color.brand.$root}`), library variables included; and, for an alias whose target no tree here holds, where it is.
 */
export class DtcgReferences {
  /** Variables whose path another took first, as notes. */
  readonly renamed: readonly string[];
  readonly #raw: RawTokens;
  readonly #included: ReadonlySet<string>;
  readonly #locations: ReadonlyMap<string, string[]>;
  readonly #references: ReadonlyMap<string, string>;

  constructor(raw: RawTokens, types: ReadonlyMap<string, string | null>, included: ReadonlySet<string>) {
    const renamed: string[] = [];
    const locations = new Map<string, string[]>();

    for (const collection of raw.collections) {
      const typed = raw.variables.filter(
        (variable) => variable.collectionId === collection.id && (types.get(variable.id) ?? null) !== null,
      );
      const entries = typed.map(({ id, name }) => ({
        id,
        name,
        path: pathOf(name),
      }));

      // Only the collections written say how their variables were renamed.
      for (const [id, path] of placements(entries, included.has(collection.id) ? renamed : [])) {
        locations.set(id, path);
      }
    }

    this.renamed = renamed;
    this.#raw = raw;
    this.#included = included;
    this.#locations = locations;
    this.#references = referencesOf(raw, locations);
  }

  /** How an alias to the variable is written, when it has a place. */
  reference(id: string): string | undefined {
    return this.#references.get(id);
  }

  /** The variable's path in its collection's trees. */
  location(id: string): string[] {
    return this.#locations.get(id) ?? [];
  }

  /** Where an alias's target lives when no tree here holds it (a collection left out, or a library); null when one does. */
  outside(id: string): string | null {
    const local = this.#raw.variables.find((variable) => variable.id === id);

    if (local !== undefined) {
      const collection = this.#raw.collections.find((candidate) => candidate.id === local.collectionId);

      return this.#included.has(local.collectionId)
        ? null
        : `${local.name} in ${collection?.name ?? local.collectionId}, which this output leaves out: add it to collections for the reference to resolve.`;
    }

    const external = this.#raw.external[id];

    return external === undefined
      ? null
      : `${external.name} from a library (${external.collection}): no file here defines it, so add that library's tokens for the reference to resolve.`;
  }
}

/** Each placed variable's reference, then each library variable's by its name's path. */
function referencesOf(raw: RawTokens, locations: ReadonlyMap<string, string[]>): Map<string, string> {
  const references = new Map([...locations].map(([id, path]) => [id, `{${path.join(".")}}`]));

  for (const [id, external] of Object.entries(raw.external)) {
    if (!references.has(id)) {
      references.set(id, `{${pathOf(external.name).join(".")}}`);
    }
  }

  return references;
}
