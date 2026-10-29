import { InjectionToken, injectable } from "@needle-di/core";
import {
  ASSET_CLASS,
  ASSET_FIGMA,
  ASSET_FORMAT,
  ASSET_KIND,
  ASSET_VALUE,
  DRAWING_CONTAINERS,
  ICON_SHAPES,
  RENDERED_EFFECTS,
  RENDERED_PAINTS,
  VECTOR_TYPES,
} from "@/core/design/assets/assets.constants.ts";
import type { AssetClass } from "@/core/design/assets/assets.types.ts";
import { TEXT_TYPES } from "@/core/design/design.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

/**
 * Whether a layer is a true asset, exported whole (C-142, m:1116170e): what the designer marked for export (not a PDF,
 * not a layer with text, which is a screen's preview, not the read's root), a mask group, a leaf whose fill is an
 * image or something CSS cannot draw, a vector, or a container drawn only with shapes and at least one true vector.
 * A leaf with a video fill is a video: no file holds it (B-001, D-23). Everything else is CSS.
 */
@injectable()
export class AssetClassifier {
  readonly #readLayers = new ReadLayers();

  classify(layer: ReadLayer, root: ReadLayer): AssetClass | null {
    const children = this.#readLayers.visibleChildren(layer);
    const leaf = children.length === 0 && layer.childCount === 0;

    if (leaf && this.#painted(layer, ASSET_FIGMA.video)) {
      return ASSET_CLASS.video;
    }

    const exported = this.#exported(layer, root);

    if (exported !== null) {
      return exported;
    }

    // Figma's mask group: the mask at the bottom clips everything above it, so the group is one picture; a frame with
    // text over a mask is still a layout, and the read's root is always read inside.
    if (
      (children[0]?.isMask ?? false) &&
      layer !== root &&
      (layer.type === ASSET_FIGMA.group || !this.#hasText(layer))
    ) {
      return ASSET_CLASS.rendered;
    }

    if (leaf && (this.#painted(layer, ASSET_FIGMA.image) || this.#needsRender(layer))) {
      return ASSET_CLASS.rendered;
    }

    const drawn = Object.hasOwn(DRAWING_CONTAINERS, layer.type) && this.#isDrawing(layer);

    return Object.hasOwn(VECTOR_TYPES, layer.type) || drawn ? ASSET_CLASS.vector : null;
  }

  /** What the designer's export settings make of a layer: nothing for a PDF, the read's root or a layer with text. */
  #exported(layer: ReadLayer, root: ReadLayer): AssetClass | null {
    const [setting] = layer.exportSettings ?? [];

    if (setting === undefined || setting.format === ASSET_FORMAT.pdf || layer === root || this.#hasText(layer)) {
      return null;
    }

    const { constraint } = setting;
    const scaled = constraint?.type === ASSET_FIGMA.scale && constraint.value !== ASSET_VALUE.naturalScale;

    return {
      kind: setting.format === ASSET_FORMAT.svg ? ASSET_KIND.icon : ASSET_KIND.image,
      format: setting.format,
      ...(scaled ? { scale: constraint.value } : {}),
    };
  }

  /** Whether a layer holds text; a branch the read cut may, so it counts as holding some. */
  #hasText(layer: ReadLayer): boolean {
    return (
      Object.hasOwn(TEXT_TYPES, layer.type) ||
      this.#cut(layer) ||
      this.#readLayers.visibleChildren(layer).some((child) => this.#hasText(child))
    );
  }

  #cut(layer: ReadLayer): boolean {
    return layer.children === undefined && layer.childCount > 0;
  }

  #painted(layer: ReadLayer, type: string): boolean {
    return Array.isArray(layer.fills) && layer.fills.some((paint) => paint.type === type && (paint.visible ?? true));
  }

  /** Painted with what CSS cannot draw: pattern or shader fills, noise, texture, glass or shader effects. */
  #needsRender(layer: ReadLayer): boolean {
    const fills = Array.isArray(layer.fills) ? layer.fills : [];

    return (
      fills.some((paint) => (paint.visible ?? true) && Object.hasOwn(RENDERED_PAINTS, paint.type)) ||
      (layer.effects ?? []).some((effect) => (effect.visible ?? true) && Object.hasOwn(RENDERED_EFFECTS, effect.type))
    );
  }

  /** A container without auto layout drawn only with shapes, at least one of them a true vector. */
  #isDrawing(layer: ReadLayer): boolean {
    const children = this.#readLayers.visibleChildren(layer);
    let vectors = 0;

    if (layer.layoutMode !== undefined || children.length === 0) {
      return false;
    }

    for (const child of children) {
      const count = this.#vectors(child);

      if (count === null) {
        return false;
      }

      vectors += count;
    }

    return vectors > 0;
  }

  /** The true vectors a shape is drawn with; null when it is no shape (text, an image, auto layout, a cut branch). */
  #vectors(layer: ReadLayer): number | null {
    if (
      this.#cut(layer) ||
      !Object.hasOwn(ICON_SHAPES, layer.type) ||
      this.#painted(layer, ASSET_FIGMA.image) ||
      layer.layoutMode !== undefined
    ) {
      return null;
    }

    let vectors = Object.hasOwn(VECTOR_TYPES, layer.type) ? 1 : 0;

    for (const child of this.#readLayers.visibleChildren(layer)) {
      const count = this.#vectors(child);

      if (count === null) {
        return null;
      }

      vectors += count;
    }

    return vectors;
  }
}

export const ASSET_CLASSIFIER = new InjectionToken<AssetClassifier>("AssetClassifier");
