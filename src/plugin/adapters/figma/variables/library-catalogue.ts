import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { LIBRARY_LIST, VARIABLES_TEXT } from "@/plugin/adapters/figma/variables/variables.constants.ts";
import type { LibraryCatalogue as Library, RawTokens } from "@/shared/ops/variables/variables.schema.ts";

type Catalogue = Pick<RawTokens, "library" | "libraryNote">;

/**
 * The enabled libraries' variable collections and their variables by name and type (T-160): values would need an
 * import, which writes to the file. LIBRARY_LIST.maxVariables names at most, the rest counted; a failure or the op's
 * deadline is said in the note, never thrown, so the file's own tokens still come back.
 */
@injectable()
export class LibraryCatalogue {
  readonly #walk;

  constructor(walk = inject(LAYER_WALK)) {
    this.#walk = walk;
  }

  async read(deadline: number): Promise<Catalogue> {
    const library: Library = [];

    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

      for (const collection of collections) {
        if (this.#walk.passed(deadline)) {
          return { ...this.#capped(library), libraryNote: VARIABLES_TEXT.slow(library.length, collections.length) };
        }

        const found = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);

        library.push({
          libraryName: collection.libraryName,
          collection: collection.name,
          key: collection.key,
          variables: found.map(({ name, key, resolvedType }) => ({ name, key, resolvedType })),
        });
      }
    } catch (error) {
      return {
        ...this.#capped(library),
        libraryNote: VARIABLES_TEXT.failed(error instanceof Error ? error.message : String(error)),
      };
    }

    return this.#capped(library);
  }

  /** At most LIBRARY_LIST.maxVariables names, in order, and a note counting the rest. */
  #capped(library: Library): Catalogue {
    const total = library.reduce((sum, collection) => sum + collection.variables.length, 0);
    const listed = library.map((collection, index) => {
      const before = library.slice(0, index).reduce((sum, earlier) => sum + earlier.variables.length, 0);

      return {
        ...collection,
        variables: collection.variables.slice(0, Math.max(0, LIBRARY_LIST.maxVariables - before)),
      };
    });
    const hidden = total - LIBRARY_LIST.maxVariables;

    return hidden > 0 ? { library: listed, libraryNote: VARIABLES_TEXT.more(hidden) } : { library: listed };
  }
}

export const LIBRARY_CATALOGUE = new InjectionToken<LibraryCatalogue>("LibraryCatalogue");
