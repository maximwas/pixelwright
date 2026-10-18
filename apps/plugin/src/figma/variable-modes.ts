import { attributeSlug } from "@pixelwright/core";
import type { IdLookup } from "./id-lookup.ts";
import { WriteError } from "./write-error.ts";

/** A layer that takes variable modes: every layer on a page does. */
export type ModedNode = SceneNode & ExplicitVariableModesMixin & { resolvedVariableModes?: Record<string, string> };

/** A mode by its collection's and its own name. */
export interface NamedMode {
  readonly collection: string;
  readonly mode: string;
}

/** Whether a name means this collection or mode: its own name in any case, or its attribute slug (design_read's). */
const means = (name: string, key: string) =>
  name.toLowerCase() === key.trim().toLowerCase() || attributeSlug(name) === key.trim();

/** The file's own variable collections and those a layer's modes name, as one call finds them. */
export async function collectionsAround(node: ModedNode, lookup: IdLookup): Promise<VariableCollection[]> {
  const local = await figma.variables.getLocalVariableCollectionsAsync();
  const ids = new Set([...local.map(({ id }) => id), ...Object.keys(node.resolvedVariableModes ?? {})]);
  const collections: VariableCollection[] = [];

  for (const id of ids) {
    const collection = await lookup.collection(id);

    if (collection !== null) {
      collections.push(collection);
    }
  }

  return collections;
}

/** The collection a name or attribute slug means; an error listing the collections there are. */
export function collectionNamed(collections: readonly VariableCollection[], key: string): VariableCollection {
  const collection = collections.find(({ name }) => means(name, key));

  if (collection === undefined) {
    throw new WriteError(
      `No variable collection is named ${key} here.`,
      collections.length === 0
        ? "The file has no variable collections."
        : `It has ${collections.map(({ name }) => `${name} (data-${attributeSlug(name)})`).join(", ")}.`,
    );
  }

  return collection;
}

/** The id of the collection's mode a name or attribute slug means; an error listing its modes. */
export function modeNamed(collection: VariableCollection, key: string): string {
  const mode = collection.modes.find(({ name }) => means(name, key));

  if (mode === undefined) {
    throw new WriteError(
      `${collection.name} has no mode ${key}.`,
      `It has ${collection.modes.map(({ name }) => `${name} ("${attributeSlug(name)}")`).join(", ")}.`,
    );
  }

  return mode.modeId;
}

/** Modes by collection id and mode id, as names: those whose collection Figma can reach. */
export async function namedModes(modes: Readonly<Record<string, string>>, lookup: IdLookup): Promise<NamedMode[]> {
  const named: NamedMode[] = [];

  for (const [collectionId, modeId] of Object.entries(modes)) {
    const collection = await lookup.collection(collectionId);
    const mode = collection?.modes.find((each) => each.modeId === modeId);

    if (collection !== null && mode !== undefined) {
      named.push({
        collection: collection.name,
        mode: mode.name,
      });
    }
  }

  return named;
}

/**
 * The modes a read's root is in that are not its collections' defaults: set on it, or taken from a frame or page
 * above it, so a dark section read alone still says it is dark.
 */
export async function rootModes(node: ModedNode, lookup: IdLookup): Promise<NamedMode[]> {
  const explicit = node.explicitVariableModes ?? {};
  const kept: Record<string, string> = {};

  for (const [collectionId, modeId] of Object.entries(node.resolvedVariableModes ?? {})) {
    const collection = explicit[collectionId] === undefined ? await lookup.collection(collectionId) : null;

    if (collection !== null && collection.defaultModeId !== modeId) {
      kept[collectionId] = modeId;
    }
  }

  return await namedModes(
    {
      ...kept,
      ...explicit,
    },
    lookup,
  );
}
