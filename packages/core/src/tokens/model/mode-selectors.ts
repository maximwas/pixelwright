import type { Notes } from "../notes.ts";
import { uniqueName } from "../unique-name.ts";

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
    const attribute = uniqueName(attributeSlug(collection.name), attributes);
    const values = new Set<string>();
    const selectors: Record<string, string> = {};

    for (const mode of collection.modes.filter((name) => name !== collection.defaultMode)) {
      const wanted = attributeSlug(mode);
      const slug = uniqueName(wanted, values);

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
