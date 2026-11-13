import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, CAPABILITY_TEXT, FIGMA_PAINT } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_IMAGES } from "@/plugin/operations/apply/apply-images.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_ASSET } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * An Image's file (T-131): its first image paint takes the new image, keeping how it fits and is cropped; a layer
 * without one gets one that fills it. An Icon's SVG is drawn when the layer is made (NewLayers), never again (T-133).
 */
@injectable()
export class AssetStep implements WriteStep {
  readonly keys = STEP_KEYS.asset;
  // Its own check names what the fills are for: an image is held in one (0.7.0).
  readonly capability = null;
  readonly #images;
  readonly #assign;
  readonly #capabilities;

  constructor(
    images = inject(APPLY_IMAGES),
    assign = inject(ASSIGN),
    capabilities = inject(CAPABILITIES),
  ) {
    this.#images = images;
    this.#assign = assign;
    this.#capabilities = capabilities;
  }

  check({ asset }: FigmaProps, layer: TypedLayer): void {
    if (asset === undefined || asset.kind === INTENT_ASSET.icon) {
      return;
    }

    if (!this.#capabilities.has(layer, CAPABILITY.fills)) {
      throw new WriteError(WRITERS_TEXT.imageFills(CAPABILITY_TEXT.type(layer.type)));
    }

    this.#images.require(asset);
  }

  write(node: SceneNode, { asset }: FigmaProps): void {
    if (asset === undefined || asset.kind === INTENT_ASSET.icon) {
      return;
    }

    const layer = node as RectangleNode;
    const imageHash = this.#images.hash(asset);
    const fills: readonly Paint[] = Array.isArray(layer.fills) ? layer.fills : [];
    const at = fills.findIndex((paint) => paint.type === FIGMA_PAINT.image);

    this.#assign.set(layer, {
      fills:
        at === -1
          ? [{ type: FIGMA_PAINT.image, imageHash, scaleMode: FIGMA_PAINT.fill }]
          : fills.map((paint, index) => (index === at ? { ...paint, imageHash } : paint)),
    });
  }
}
