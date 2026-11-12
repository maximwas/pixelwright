import { type RawTokens, tokenName } from "@pixelwright/core";
import { LIBRARY_BUDGET_MS } from "../../constants/plugin.ts";
import { errorMessage } from "../../utils/error-message.ts";

type LibraryCatalogue = Pick<RawTokens, "library" | "libraryError">;

/** An enabled library's variable as figma.teamLibrary lists it. */
export interface LibraryVariable {
  readonly key: string;
  readonly name: string;
  readonly resolvedType: string;
}

/**
 * The enabled libraries' variable collections and their variables, within LIBRARY_BUDGET_MS so the local tokens still
 * come back in time; a failure or the budget running out is said in libraryError, never thrown. Their values would
 * need an import, which writes to the file, so only names and types are listed.
 */
export async function libraryCatalogue(): Promise<LibraryCatalogue> {
  const library: NonNullable<RawTokens["library"]> = [];
  const started = Date.now();

  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    for (const collection of collections) {
      if (Date.now() - started > LIBRARY_BUDGET_MS) {
        return {
          library,
          libraryError: `The libraries took too long: read ${library.length} of ${collections.length} collections.`,
        };
      }

      const found = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);

      library.push({
        libraryName: collection.libraryName,
        collection: collection.name,
        key: collection.key,
        variables: found.map(({ key, name, resolvedType }) => ({
          key,
          name,
          resolvedType,
        })),
      });
    }

    return { library };
  } catch (error) {
    return {
      ...(library.length === 0 ? {} : { library }),
      libraryError: `The libraries could not be read: ${errorMessage(error)}`,
    };
  }
}

/** The enabled libraries' variables by the CSS name design_read would give them; none when the libraries fail. */
export async function libraryVariablesByToken(): Promise<Map<string, LibraryVariable>> {
  const found = new Map<string, LibraryVariable>();

  try {
    for (const collection of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) {
      for (const variable of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)) {
        found.set(tokenName(variable.name), variable);
      }
    }
  } catch {
    // Libraries that cannot be read leave the name unknown, which is the error the caller gives.
  }

  return found;
}

/** The enabled libraries' collection names; none when the libraries cannot be read. */
export async function libraryCollectionNames(): Promise<Set<string>> {
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    return new Set(collections.map((collection) => collection.name));
  } catch {
    return new Set();
  }
}
