import { inject, injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Mode = NonNullable<ReadLayer["modes"]>[number];

/** The variable modes set on the layer itself (C-135), by collection and mode name: those whose collection Figma can reach. */
@injectable()
export class ModeFieldReader implements FieldReader {
  readonly #lookup;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  async read(node: SceneNode): Promise<Partial<ReadLayer>> {
    const explicit = "explicitVariableModes" in node ? node.explicitVariableModes : {};
    const modes: Mode[] = [];

    for (const [collectionId, modeId] of Object.entries(explicit)) {
      const collection = await this.#lookup.collection(collectionId).catch(() => null);
      const mode = collection?.modes.find((each) => each.modeId === modeId);

      if (collection !== null && mode !== undefined) {
        modes.push({ collection: collection.name, mode: mode.name });
      }
    }

    return modes.length === 0 ? {} : { modes };
  }
}
