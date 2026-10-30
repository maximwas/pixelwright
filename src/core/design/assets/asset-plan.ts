import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { PAINTS_TEXT } from "@/core/css/paints/paints.constants.ts";
import type { CssDeclaration, LayerCss } from "@/core/css/registry/css-declarations.ts";
import type { AssetCss } from "@/core/design/assets/asset-css.ts";
import { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";
import type { PlannedAsset, PlannedFile } from "@/core/design/assets/assets.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * One read's planned assets (C-144), as the XML uses them: a layer's file, the CSS its element keeps, and the planned
 * file of each image behind content in place of the image's hash.
 */
export class AssetPlan {
  readonly #assets: readonly PlannedAsset[];
  readonly #files: ReadonlyMap<string, PlannedFile>;
  readonly #backgrounds: ReadonlyMap<string, string>;
  readonly #css: AssetCss;

  constructor(assets: readonly PlannedAsset[], css: AssetCss) {
    const files = assets.filter((asset): asset is PlannedFile => asset.kind !== ASSET_KIND.video);

    this.#assets = assets;
    this.#files = new Map(files.flatMap((file) => (file.imageHash === undefined ? [[file.node, file]] : [])));
    this.#backgrounds = new Map(
      files.flatMap(({ imageHash, src }) => (imageHash === undefined ? [] : [[imageHash, src]])),
    );
    this.#css = css;
  }

  /** The file a layer is exported as; undefined for a layer written as CSS. */
  file(id: string): PlannedFile | undefined {
    return this.#files.get(id);
  }

  /** The CSS a layer's element writes: an asset's placement only, or the layer's with its images' planned files. */
  css(
    layer: ReadLayer,
    parent: ReadLayer | null,
    css: LayerCss,
  ): CssDeclaration[] {
    const file = this.#files.get(layer.id);

    if (file !== undefined) {
      return this.#css.css(layer, parent, file.kind, css.properties);
    }

    return css.properties.map(([property, value]) =>
      property === CSS_PROPERTY.background ? [property, this.#background(value)] : [property, value],
    );
  }

  assets(): readonly PlannedAsset[] {
    return this.#assets;
  }

  /** The plan with each file's src as `src` gives it: the path it was written to (T-055). */
  moved(src: (file: PlannedFile) => string): AssetPlan {
    return new AssetPlan(
      this.#assets.map((asset) => (asset.kind === ASSET_KIND.video ? asset : { ...asset, src: src(asset) })),
      this.#css,
    );
  }

  /** ImagePaint names an image by its hash: the planned file takes its place. */
  #background(value: string): string {
    return [...this.#backgrounds].reduce((css, [hash, src]) => css.replaceAll(PAINTS_TEXT.asset(hash), src), value);
  }
}
