import type { FigmaProps } from "@pixelwright/core";
import { IdLookup } from "../../../figma/id-lookup.ts";
import { collectionNamed, collectionsAround, type ModedNode, modeNamed } from "../../../figma/variable-modes.ts";
import type { Step } from "./step.ts";

/**
 * The variable modes a layer is set to, by collection and mode (names or the attribute slugs design_read writes): a
 * mode is set where the layer is not in it already; an empty one clears the collection's, so the layer takes its
 * parent's. Every name is found before the first mode is set, so a wrong one changes nothing.
 */
async function modes(node: SceneNode, { modes: given }: FigmaProps): Promise<void> {
  const layer = node as ModedNode;
  const collections = await collectionsAround(layer, new IdLookup());
  const writes = Object.entries(given ?? {}).map(([key, mode]) => {
    const collection = collectionNamed(collections, key);

    return {
      collection,
      mode: mode === "" ? null : modeNamed(collection, mode),
    };
  });

  const explicit = layer.explicitVariableModes ?? {};

  for (const { collection, mode } of writes) {
    if (mode === null) {
      if (explicit[collection.id] !== undefined) {
        layer.clearExplicitVariableModeForCollection(collection);
      }
    } else if (explicit[collection.id] !== mode) {
      layer.setExplicitVariableModeForCollection(collection, mode);
    }
  }
}

/** The variable modes a layer is in. */
export const MODE_STEPS: readonly Step[] = [
  {
    keys: ["modes"],
    write: modes,
  },
];
