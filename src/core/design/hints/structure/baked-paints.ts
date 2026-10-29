import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HINT_LABEL } from "@/core/design/hints/hints.constants.ts";
import { ROOM_SLACK, STRUCTURE_FIGMA, STRUCTURE_TEXT } from "@/core/design/hints/structure/structure.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

type Paint = NonNullable<ReadLayer["strokes"]>[number];

/** What a walk finds: baked fades, then tiled textures. */
interface Found {
  readonly fades: string[];
  readonly tiles: string[];
}

/**
 * Paints an export bakes (Q-004, Q-005): an image with a gradient in its fills or laid over it, which a flattened export
 * stretches, and textures tiled at a scale, which render coarser or finer at another. Assets included: an image layer
 * is one, and these hints are about how to export it.
 */
@injectable()
export class BakedPaints {
  readonly #readLayers = new ReadLayers();
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  read(root: ReadLayer): string[] {
    const found: Found = { fades: [], tiles: [] };

    this.#walk(root, found);

    return [
      ...(found.fades.length === 0 ? [] : [STRUCTURE_TEXT.fade(found.fades)]),
      ...(found.tiles.length === 0 ? [] : [STRUCTURE_TEXT.tiled(found.tiles)]),
    ];
  }

  #walk(layer: ReadLayer, found: Found): void {
    const fills = this.#fills(layer);

    if (fills.some((paint) => this.#image(paint)) && fills.some((paint) => this.#gradient(paint))) {
      found.fades.push(this.#label(layer));
    }

    found.tiles.push(...this.#tiles(layer, fills));

    const children = this.#readLayers.visibleChildren(layer);

    children.forEach((child, index) => {
      const image = this.#under(child, children.slice(0, index));

      if (image !== undefined) {
        found.fades.push(STRUCTURE_TEXT.fadeOver(this.#label(child), image.id));
      }

      this.#walk(child, found);
    });
  }

  /** The image a layer of gradients only lies over, among the layers below it. */
  #under(layer: ReadLayer, below: readonly ReadLayer[]): ReadLayer | undefined {
    const fills = this.#fills(layer);

    if (fills.length === 0 || !fills.every((paint) => this.#gradient(paint))) {
      return undefined;
    }

    return [...below]
      .reverse()
      .find((other) => this.#fills(other).some((paint) => this.#image(paint)) && this.#within(layer, other));
  }

  #tiles(layer: ReadLayer, fills: readonly Paint[]): string[] {
    const images = fills
      .filter((paint) => this.#image(paint) && paint.scaleMode === STRUCTURE_FIGMA.tile)
      .map((paint) =>
        STRUCTURE_TEXT.tiledImage(
          this.#label(layer),
          this.#number(typeof paint.scalingFactor === "number" ? paint.scalingFactor : 1),
        ),
      );
    const noises = (layer.effects ?? [])
      .filter((effect) => effect.type === STRUCTURE_FIGMA.noise && (effect.visible ?? true))
      .map((effect) =>
        STRUCTURE_TEXT.noise(
          this.#label(layer),
          HINT_LABEL.px(this.#number(typeof effect.noiseSize === "number" ? effect.noiseSize : 0)),
        ),
      );

    return [...images, ...noises];
  }

  #fills(layer: ReadLayer): Paint[] {
    return Array.isArray(layer.fills) ? layer.fills.filter((paint) => paint.visible ?? true) : [];
  }

  #image(paint: Paint): boolean {
    return paint.type === STRUCTURE_FIGMA.image;
  }

  #gradient(paint: Paint): boolean {
    return paint.type.startsWith(STRUCTURE_FIGMA.gradient);
  }

  #within(inner: ReadLayer, outer: ReadLayer): boolean {
    return (
      inner.x >= outer.x - ROOM_SLACK &&
      inner.y >= outer.y - ROOM_SLACK &&
      inner.x + inner.width <= outer.x + outer.width + ROOM_SLACK &&
      inner.y + inner.height <= outer.y + outer.height + ROOM_SLACK
    );
  }

  #label(layer: ReadLayer): string {
    return HINT_LABEL.layer(layer.id, layer.name);
  }

  #number(value: number): number {
    return this.#format.round(value, PRECISION.decimal);
  }
}

export const BAKED_PAINTS = new InjectionToken<BakedPaints>("BakedPaints");
