import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DTCG_NOTE, DTCG_TEXT } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { DtcgPlaces } from "@/core/tokens/formats/dtcg/dtcg.types.ts";
import { DTCG_PATHS } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DTCG_TYPES } from "@/core/tokens/formats/dtcg/dtcg-types.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * Where every typed variable sits in its collection's trees and how an alias names it (`{color.brand}`,
 * `{color.brand.$root}`), a library's variable by its name's path (K-016); and, for an alias whose target no tree here
 * holds, where that target lives.
 */
@injectable()
export class DtcgReferences {
  readonly #types;
  readonly #paths;

  constructor(types = inject(DTCG_TYPES), paths = inject(DTCG_PATHS)) {
    this.#types = types;
    this.#paths = paths;
  }

  /** Every variable's type, every typed one's place and reference, and the renames in the collections written. */
  places(raw: RawTokens, written: ReadonlySet<string>): DtcgPlaces {
    const types = this.#types.types(raw.variables);
    const renamed: string[] = [];
    const locations = new Map<string, readonly string[]>();

    for (const collection of raw.collections) {
      const entries = raw.variables
        .filter((variable) => variable.collectionId === collection.id && (types.get(variable.id) ?? null) !== null)
        .map(({ id, name }) => ({ id, name, path: this.#paths.path(name) }));

      // Only the collections written say how their variables were renamed.
      for (const [id, path] of this.#paths.places(entries, written.has(collection.id) ? renamed : [])) {
        locations.set(id, path);
      }
    }

    const references = new Map([...locations].map(([id, path]) => [id, DTCG_TEXT.reference(path)]));

    for (const [id, external] of Object.entries(raw.external)) {
      if (!references.has(id)) {
        references.set(id, DTCG_TEXT.reference(this.#paths.path(external.name)));
      }
    }

    return { types, locations, references, renamed };
  }

  /** Where an alias's target lives when no tree here holds it (a collection left out, or a library); null when one does. */
  outside(
    raw: RawTokens,
    written: ReadonlySet<string>,
    id: string,
  ): string | null {
    const local = raw.variables.find((variable) => variable.id === id);

    if (local !== undefined) {
      const collection = raw.collections.find((candidate) => candidate.id === local.collectionId);

      return written.has(local.collectionId)
        ? null
        : DTCG_NOTE.leftOut(local.name, collection?.name ?? local.collectionId);
    }

    const external = raw.external[id];

    return external === undefined ? null : DTCG_NOTE.library(external.name, external.collection);
  }
}

export const DTCG_REFERENCES = new InjectionToken<DtcgReferences>("DtcgReferences");
