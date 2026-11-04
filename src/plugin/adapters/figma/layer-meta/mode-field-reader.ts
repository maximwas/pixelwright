import { inject, injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Mode = NonNullable<ReadLayer["modes"]>[number];

/**
 * The variable modes set on the layer itself (C-135), by collection and mode name: those whose collection Figma can
 * reach. A read's root also says, first, the non-default modes it takes from a frame or page above it (m:c8a83979): a
 * section read alone still says it is dark, and a read sent back writes nothing.
 */
@injectable()
export class ModeFieldReader implements FieldReader {
  readonly #lookup;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  async read(
    node: SceneNode,
    _origin: Vector,
    root: boolean,
  ): Promise<Partial<ReadLayer>> {
    const explicit = "explicitVariableModes" in node ? node.explicitVariableModes : {};
    const inherited = root ? await this.#inherited(node, explicit) : {};
    const modes: Mode[] = [];

    for (const [collectionId, modeId] of Object.entries({ ...inherited, ...explicit })) {
      const collection = await this.#lookup.collection(collectionId).catch(() => null);
      const mode = collection?.modes.find((each) => each.modeId === modeId);

      if (collection !== null && mode !== undefined) {
        modes.push({ collection: collection.name, mode: mode.name });
      }
    }

    return modes.length === 0 ? {} : { modes };
  }

  /** The non-default modes the layer takes from above, by collection id: those it does not set itself. */
  async #inherited(node: SceneNode, explicit: Readonly<Record<string, string>>): Promise<Record<string, string>> {
    const resolved = "resolvedVariableModes" in node ? node.resolvedVariableModes : {};
    const inherited: Record<string, string> = {};

    for (const [collectionId, modeId] of Object.entries(resolved)) {
      if (!Object.hasOwn(explicit, collectionId)) {
        const collection = await this.#lookup.collection(collectionId).catch(() => null);

        if (collection !== null && collection.defaultModeId !== modeId) {
          inherited[collectionId] = modeId;
        }
      }
    }

    return inherited;
  }
}
