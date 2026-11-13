import { inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { CAPABILITY_TEXT } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * The variable modes a layer is set to (C-135), by collection and mode, each as its name or the slug design_read
 * writes: a mode is set where the layer is not in it already; an empty one clears the collection's, so the layer takes
 * its parent's. Every name is found before the first mode is set, so a wrong one changes nothing.
 */
@injectable()
export class ModeStep implements WriteStep {
  readonly keys = STEP_KEYS.modes;
  readonly capability = null;
  readonly #factory;
  readonly #lookup;
  readonly #names;

  constructor(
    factory = inject(LAYER_FACTORY),
    lookup = inject(NODE_LOOKUP),
    names = inject(TOKEN_NAMES),
  ) {
    this.#factory = factory;
    this.#lookup = lookup;
    this.#names = names;
  }

  async write(node: SceneNode, { modes }: FigmaProps): Promise<void> {
    const layer = node as FrameNode;

    if (typeof layer.setExplicitVariableModeForCollection !== "function") {
      throw new WriteError(WRITERS_TEXT.noModes(CAPABILITY_TEXT.type(node.type)));
    }

    const collections = await this.#around(layer);
    const writes = Object.entries(modes ?? {}).map(([key, mode]) => {
      const collection = this.#collection(collections, key);

      return { collection, mode: mode === "" ? null : this.#mode(collection, mode) };
    });
    const explicit = layer.explicitVariableModes;

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

  /** The file's collections and the libraries' the layer is in a mode of. */
  async #around(layer: FrameNode): Promise<VariableCollection[]> {
    const found = new Map((await this.#factory.collections()).map((collection) => [collection.id, collection]));

    for (const id of Object.keys({ ...layer.resolvedVariableModes, ...layer.explicitVariableModes })) {
      const collection = found.has(id) ? null : await this.#lookup.collection(id);

      if (collection !== null) {
        found.set(id, collection);
      }
    }

    return [...found.values()];
  }

  #collection(collections: readonly VariableCollection[], key: string): VariableCollection {
    const collection = collections.find(({ name }) => name === key || this.#names.attribute(name) === key);

    if (collection === undefined) {
      throw new WriteError(WRITERS_TEXT.noCollection(key), WRITERS_TEXT.modesHint);
    }

    return collection;
  }

  #mode(collection: VariableCollection, mode: string): string {
    const found = collection.modes.find(({ name }) => name === mode || this.#names.attribute(name) === mode);

    if (found === undefined) {
      const modes = collection.modes.map(({ name }) => this.#names.attribute(name));

      throw new WriteError(WRITERS_TEXT.noMode(collection.name, mode, modes), WRITERS_TEXT.modesHint);
    }

    return found.modeId;
  }
}
