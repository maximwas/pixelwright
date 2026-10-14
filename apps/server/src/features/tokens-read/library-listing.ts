import type { RawTokens } from "@pixelwright/core";
import { MAX_LIBRARY_VARIABLES } from "./constants.ts";

type Library = NonNullable<RawTokens["library"]>;

/** The enabled libraries' variables up to MAX_LIBRARY_VARIABLES names, and a note counting the rest when there are more. */
export function libraryListing(library: Library): { library: Library; notes: string[] } {
  let left = MAX_LIBRARY_VARIABLES;
  let hidden = 0;
  const listed = library.map((collection) => {
    const variables = collection.variables.slice(0, Math.max(0, left));

    hidden += collection.variables.length - variables.length;
    left -= variables.length;

    return {
      ...collection,
      variables,
    };
  });

  return {
    library: listed,
    notes:
      hidden === 0
        ? []
        : [
            `${hidden} more library variables are not listed: read a smaller set by naming collections in the library itself.`,
          ],
  };
}
