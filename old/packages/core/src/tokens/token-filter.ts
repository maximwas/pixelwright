import type { RawCollection, RawTokens } from "./raw-tokens.ts";

/** Which collections an output takes, by name in any case; all of them when none are named. */
export interface TokenFilter {
  readonly collections?: readonly string[];
}

/** The collections the filter names, in the file's order. */
export function filteredCollections(raw: RawTokens, filter: TokenFilter): RawCollection[] {
  const wanted = filter.collections?.map((name) => name.toLowerCase());

  return raw.collections.filter((collection) => wanted === undefined || wanted.includes(collection.name.toLowerCase()));
}
