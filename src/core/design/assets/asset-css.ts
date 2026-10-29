import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { ASSET_KIND, ASSET_VALUE, ICON_KEEPS, IMAGE_KEEPS } from "@/core/design/assets/assets.constants.ts";
import type { FileKind } from "@/core/design/assets/assets.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * An asset's CSS (C-143): what it keeps of the layer's, placed where its file goes. Figma exports a turned or mirrored
 * layer already turned, so the asset takes the box it covers and no transform; an icon is exported with what it draws
 * outside its geometry (centred and outside strokes), so it takes its render bounds. An image keeps only its outside
 * (drop) shadows: the inner ones are in the file.
 */
@injectable()
export class AssetCss {
  readonly #lengths;
  readonly #split;

  constructor(lengths = inject(CSS_LENGTH), split = inject(CSS_SPLIT)) {
    this.#lengths = lengths;
    this.#split = split;
  }

  css(
    layer: ReadLayer,
    parent: ReadLayer | null,
    kind: FileKind,
    properties: readonly CssDeclaration[],
  ): CssDeclaration[] {
    const keeps = kind === ASSET_KIND.icon ? ICON_KEEPS : IMAGE_KEEPS;
    const outside = properties
      .filter(([property]) => keeps.includes(property))
      .map(
        ([property, value]): CssDeclaration =>
          property === CSS_PROPERTY.boxShadow ? [property, this.#outsideShadows(value)] : [property, value],
      )
      .filter(([, value]) => value !== ASSET_VALUE.none);
    const bounds = kind === ASSET_KIND.icon ? (layer.renderBounds ?? layer.bounds) : layer.bounds;

    if (bounds === undefined) {
      return outside;
    }

    const placed = new Map(outside.filter(([property]) => property !== CSS_PROPERTY.transform));

    placed.set(CSS_PROPERTY.width, this.#lengths.px(bounds.width));
    placed.set(CSS_PROPERTY.height, this.#lengths.px(bounds.height));

    if (placed.has(CSS_PROPERTY.left) && parent !== null) {
      placed.set(CSS_PROPERTY.left, this.#lengths.px(bounds.x - parent.x));
    }

    if (placed.has(CSS_PROPERTY.top) && parent !== null) {
      placed.set(CSS_PROPERTY.top, this.#lengths.px(bounds.y - parent.y));
    }

    return outside
      .filter(([property]) => placed.has(property))
      .map(([property]) => [property, placed.get(property) ?? ASSET_VALUE.none]);
  }

  /** A box-shadow list without its inset shadows, split where CSS sees the commas between shadows. */
  #outsideShadows(value: string): string {
    return this.#split
      .split(value, CSS_SEPARATOR.comma)
      .map((shadow) => shadow.trim())
      .filter((shadow) => !shadow.startsWith(ASSET_VALUE.inset))
      .join(ASSET_VALUE.shadowJoint);
  }
}

export const ASSET_CSS = new InjectionToken<AssetCss>("AssetCss");
