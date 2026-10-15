import type { RawTokens } from "../../tokens/raw-tokens.ts";
import type { Snapshot } from "../../types/snapshot.ts";

/**
 * The tokens a baseline keeps: the variables the snapshot names and every variable their aliases reach, the collections
 * of those with all their modes, the styles the snapshot names, and the library variables aliases point at. The
 * library catalogue is left out: a baseline compares what the layer uses.
 */
export function usedTokens(raw: RawTokens, snapshot: Snapshot): RawTokens {
  const variables = new Map(raw.variables.map((variable) => [variable.id, variable]));
  const kept = new Set<string>();
  const external = new Set<string>();
  const queue = Object.keys(snapshot.variables);

  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const variable = variables.get(id);

    if (variable === undefined) {
      if (raw.external[id] !== undefined) {
        external.add(id);
      }
    } else if (!kept.has(id)) {
      kept.add(id);
      queue.push(...aliasesOf(variable.valuesByMode));
    }
  }

  const collections = new Set(
    raw.variables.filter((variable) => kept.has(variable.id)).map((variable) => variable.collectionId),
  );

  return {
    collections: raw.collections.filter((collection) => collections.has(collection.id)),
    variables: raw.variables.filter((variable) => kept.has(variable.id)),
    external: Object.fromEntries(Object.entries(raw.external).filter(([id]) => external.has(id))),
    styles: raw.styles.filter((style) => snapshot.styles[style.id] !== undefined),
    ...(raw.colorProfile === undefined ? {} : { colorProfile: raw.colorProfile }),
  };
}

/** The ids a variable's values alias, in every mode. */
function aliasesOf(valuesByMode: Readonly<Record<string, unknown>>): string[] {
  return Object.values(valuesByMode).flatMap((value) =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS" &&
    "id" in value &&
    typeof value.id === "string"
      ? [value.id]
      : [],
  );
}
