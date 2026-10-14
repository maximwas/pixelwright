import type { Notes } from "../notes.ts";

/** What a collection's mode selectors are made of. */
interface ModedCollection {
  readonly name: string;
  readonly modes: readonly string[];
  readonly defaultMode: string;
}

/**
 * Each collection's selectors, by mode: `[data-<collection>="<mode>"]` for every mode but the default, letters of any
 * script kept. Two modes (or two collections) that would share one get -2, and a note says so.
 */
export function modeSelectors(collections: readonly ModedCollection[], notes: Notes): Record<string, string>[] {
  const attributes = new Set<string>();

  return collections.map((collection) => {
    const attribute = unique(attributeSlug(collection.name), attributes);
    const values = new Set<string>();
    const selectors: Record<string, string> = {};

    for (const mode of collection.modes.filter((name) => name !== collection.defaultMode)) {
      const wanted = attributeSlug(mode);
      const slug = unique(wanted, values);

      if (slug !== wanted) {
        notes.add(`Mode "${mode}" of ${collection.name} would share the selector value "${wanted}": it is "${slug}".`);
      }

      selectors[mode] = `[data-${attribute}="${slug}"]`;
    }

    return selectors;
  });
}

/** A name as an HTML attribute name or value: lower case, letters and digits of any script, the rest as "-". */
function attributeSlug(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned === "" ? "mode" : cleaned;
}

/** The wanted name, or the first `-2`, `-3`… none has taken; it is taken from then on. */
function unique(wanted: string, taken: Set<string>): string {
  let candidate = wanted;

  for (let index = 2; taken.has(candidate); index++) {
    candidate = `${wanted}-${index}`;
  }

  taken.add(candidate);

  return candidate;
}
