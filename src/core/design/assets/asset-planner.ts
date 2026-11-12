import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSET_CLASSIFIER } from "@/core/design/assets/asset-classifier.ts";
import { ASSET_CSS } from "@/core/design/assets/asset-css.ts";
import { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import {
  ASSET_FIGMA,
  ASSET_FORMAT,
  ASSET_KIND,
  ASSET_TEXT,
  ASSET_VALUE,
} from "@/core/design/assets/assets.constants.ts";
import type { AssetClass, PlannedAsset, PlannedFile } from "@/core/design/assets/assets.types.ts";
import { INVISIBLE_TYPES, TEXT_TYPES } from "@/core/design/design.constants.ts";
import { SLUG } from "@/core/kernel/names/slug.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** One plan's running state: the file names taken, the image hashes planned, the assets in the XML's order. */
interface PlanState {
  readonly root: ReadLayer;
  readonly names: Set<string>;
  readonly hashes: Set<string>;
  readonly assets: PlannedAsset[];
}

/**
 * The files a read plans (C-144, 0.7.0's numbering): a render per asset layer and the original image behind content,
 * one file per image hash however many layers use it (`<layer>-background.png`), each named by the slug of the layer's
 * name and variant values and taken once per full file name (`logo.svg`, `logo-2.svg`, `logo.png`). Layers are planned
 * in the XML's order, hidden layers and slices left out, nothing inside an asset; a video fill is listed with no file.
 */
@injectable()
export class AssetPlanner {
  readonly #classifier;
  readonly #slug;
  readonly #css;

  constructor(
    classifier = inject(ASSET_CLASSIFIER),
    slug = inject(SLUG),
    css = inject(ASSET_CSS),
  ) {
    this.#classifier = classifier;
    this.#slug = slug;
    this.#css = css;
  }

  plan(model: ReadModel): AssetPlan {
    const state: PlanState = { root: model.root, names: new Set(), hashes: new Set(), assets: [] };

    this.#walk(model.root, state);

    return new AssetPlan(state.assets, this.#css);
  }

  #walk(layer: ReadLayer, state: PlanState): void {
    if (Object.hasOwn(INVISIBLE_TYPES, layer.type) || !layer.visible) {
      return;
    }

    const asset = this.#classifier.classify(layer, state.root);

    if (asset !== null) {
      state.assets.push(this.#asset(layer, asset, state));

      return;
    }

    this.#backgrounds(layer, state);

    for (const child of layer.children ?? []) {
      this.#walk(child, state);
    }
  }

  #asset(
    layer: ReadLayer,
    asset: AssetClass,
    state: PlanState,
  ): PlannedAsset {
    if (asset.kind === ASSET_KIND.video) {
      return { node: layer.id, kind: asset.kind };
    }

    // An instance is named by its variant too: six "Company logo" instances are six different logos.
    const variants = Object.values(layer.instance?.properties ?? {})
      .filter((property) => property.type === ASSET_FIGMA.variant)
      .map((property) => String(property.value));
    const base = this.#slug.of([layer.name, ...variants].join(ASSET_VALUE.wordJoint));

    return {
      node: layer.id,
      kind: asset.kind,
      format: asset.format,
      src: this.#fileName(base, asset.format.toLowerCase(), state.names),
      ...(asset.scale === undefined ? {} : { scale: asset.scale }),
    };
  }

  /** Each image fill behind the layer's content: its original image, once per hash. */
  #backgrounds(layer: ReadLayer, state: PlanState): void {
    if (Object.hasOwn(TEXT_TYPES, layer.type) || !Array.isArray(layer.fills)) {
      return;
    }

    for (const { type, visible, imageHash } of layer.fills) {
      if (
        type !== ASSET_FIGMA.image ||
        !(visible ?? true) ||
        typeof imageHash !== "string" ||
        state.hashes.has(imageHash)
      ) {
        continue;
      }

      const base = ASSET_TEXT.background(this.#slug.of(layer.name));
      const extension = ASSET_FORMAT.png.toLowerCase();
      const background: PlannedFile = {
        node: layer.id,
        kind: ASSET_KIND.image,
        format: ASSET_FORMAT.png,
        src: this.#fileName(base, extension, state.names),
        imageHash,
      };

      state.hashes.add(imageHash);
      state.assets.push(background);
    }
  }

  /** The file's path, its name suffixed `-2`, `-3` while the full name is taken. */
  #fileName(
    base: string,
    extension: string,
    names: Set<string>,
  ): string {
    let name = ASSET_TEXT.name(base, extension);

    for (let number: number = ASSET_VALUE.firstNumber; names.has(name); number++) {
      name = ASSET_TEXT.numbered(base, number, extension);
    }

    names.add(name);

    return ASSET_TEXT.file(ASSET_VALUE.path, name);
  }
}

export const ASSET_PLANNER = new InjectionToken<AssetPlanner>("AssetPlanner");
