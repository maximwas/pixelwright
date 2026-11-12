import type { Notes } from "../notes.ts";
import type { RawTokens } from "../raw-tokens.ts";
import type { TokenCollection } from "./types.ts";

/** Every var() the written collections use but do not define, noted with the collection that holds it. */
export function noteMissingTargets(
  collections: readonly TokenCollection[],
  raw: RawTokens,
  names: ReadonlyMap<string, string>,
  notes: Notes,
): void {
  const defined = new Set(collections.flatMap((collection) => collection.variables.map((variable) => variable.token)));
  const homes = homesOf(raw, names);

  for (const token of usedTokens(collections)) {
    if (defined.has(token)) {
      continue;
    }

    const home = homes.get(token) ?? "";

    notes.add(
      home === ""
        ? `${token} is used but defined nowhere in this output.`
        : `${token} is used but not in this output: it is in ${home}; add that collection to collections.`,
    );
  }
}

/** The collection each token's variable lives in, by token: the file's own by name, a library's said so. */
function homesOf(raw: RawTokens, names: ReadonlyMap<string, string>): Map<string, string> {
  const homes = new Map<string, string>();

  for (const variable of raw.variables) {
    const home = raw.collections.find((collection) => collection.id === variable.collectionId)?.name ?? "";

    homes.set(names.get(variable.id) ?? "", home);
  }

  for (const [id, variable] of Object.entries(raw.external)) {
    homes.set(names.get(id) ?? "", variable.collection === "" ? "a library" : `${variable.collection} (a library)`);
  }

  return homes;
}

/** Every token a var() in the collections' values names, in the order first met. */
function usedTokens(collections: readonly TokenCollection[]): Set<string> {
  const used = new Set<string>();

  for (const value of collections.flatMap((collection) =>
    collection.variables.flatMap((variable) => Object.values(variable.values)),
  )) {
    for (const [, token] of value.matchAll(/var\((--[^)]+)\)/g)) {
      if (token !== undefined) {
        used.add(token);
      }
    }
  }

  return used;
}
