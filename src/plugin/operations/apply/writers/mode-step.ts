import { inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY_TEXT } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * The variable modes a layer is set to (C-135), by collection and mode, each as its name in any case or the slug
 * design_read writes, trimmed: a mode is set where the layer is not in it already; an empty one clears the collection's, so the layer takes
 * its parent's. Every name is found in the check, on dry and real runs, and again before the first mode is set, so a wrong one
 * changes nothing.
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

  /** The collections and modes named exist, found without writing (a layer a dry run has not made is typed only). */
  async check({ modes }: FigmaProps, layer: TypedLayer): Promise<void> {
    await this.#writes(layer as FrameNode, modes);
  }

  async write(node: SceneNode, { modes }: FigmaProps): Promise<void> {
    const layer = node as FrameNode;

    if (typeof layer.setExplicitVariableModeForCollection !== "function") {
      throw new WriteError(WRITERS_TEXT.noModes(CAPABILITY_TEXT.type(node.type)));
    }

    const writes = await this.#writes(layer, modes);
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

  /** Each name found as the collection and the mode id it sets (null: clear); a wrong one throws. */
  async #writes(layer: FrameNode,    modes: FigmaProps["modes"]): Promise<{ collection: VariableCollection; mode: string | null }[]> {
    const collections = await this.#around(layer);

    return Object.entries(modes ?? {}).map(([key, mode]) => {
      const collection = this.#collection(collections, key);

      return { collection, mode: mode === "" ? null : this.#mode(collection, mode) };
    });
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
    const collection = collections.find(({ name }) => this.#means(name, key));

    if (collection === undefined) {
      const listed = collections.map(({ name }) => WRITERS_TEXT.listedCollection(name, this.#names.attribute(name)));

      throw new WriteError(
        WRITERS_TEXT.noCollection(key),
        listed.length === 0 ? WRITERS_TEXT.noCollections : WRITERS_TEXT.collections(listed),
      );
    }

    return collection;
  }

  /** Whether a name means this collection or mode: its own name in any case, or its slug (design_read's), trimmed (0.7.0). */
  #means(name: string, key: string): boolean {
    const trimmed = key.trim();

    return name.toLowerCase() === trimmed.toLowerCase() || this.#names.attribute(name) === trimmed;
  }

  #mode(collection: VariableCollection, mode: string): string {
    const found = collection.modes.find(({ name }) => this.#means(name, mode));

    if (found === undefined) {
      const modes = collection.modes.map(({ name }) => this.#names.attribute(name));

      throw new WriteError(WRITERS_TEXT.noMode(collection.name, mode, modes), WRITERS_TEXT.modesHint);
    }

    return found.modeId;
  }
}
