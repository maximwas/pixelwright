import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY, FIGMA_PAINT } from "@/plugin/adapters/figma/figma.constants.ts";
import { APPLY_IMAGES } from "@/plugin/operations/apply/apply-images.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_ASSET } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * An Image's file (T-131): its first image paint takes the new image, keeping how it fits and is cropped; a layer
 * without one gets one that fills it. An Icon's SVG is drawn when the layer is made (NewLayers), never again (T-133).
 */
@injectable()
export class AssetStep implements WriteStep {
  readonly keys = STEP_KEYS.asset;
  readonly capability = CAPABILITY.fills;
  readonly #images;
  readonly #assign;

  constructor(images = inject(APPLY_IMAGES), assign = inject(ASSIGN)) {
    this.#images = images;
    this.#assign = assign;
  }

  check({ asset }: FigmaProps): void {
    if (asset !== undefined && asset.kind !== INTENT_ASSET.icon) {
      this.#images.require(asset);
    }
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
