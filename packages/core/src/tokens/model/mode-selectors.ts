import { attributeSlug } from "../../kernel/names.ts";
import type { Notes } from "../notes.ts";
import { uniqueName } from "../unique-name.ts";

/** What a collection's mode selectors are made of. */
interface ModedCollection {
  readonly name: string;
  readonly modes: readonly string[];
  readonly defaultMode: string;
}

/**
 * Each collection's selectors, by mode: `[data-<collection>="<mode>"]` for every mode of a collection with more than
 * one (the default's sets its values back inside another mode's element), letters of any script kept. Two modes (or two
 * collections) that would share one get -2, and a note says so.
 */
export function modeSelectors(collections: readonly ModedCollection[], notes: Notes): Record<string, string>[] {
  const attributes = new Set<string>();

  return collections.map((collection) => {
    const attribute = uniqueName(attributeSlug(collection.name), attributes);
    const values = new Set<string>();
    const selectors: Record<string, string> = {};

    const modes =
      collection.modes.length > 1
        ? [collection.defaultMode, ...collection.modes.filter((name) => name !== collection.defaultMode)]
        : [];

    for (const mode of modes) {
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
