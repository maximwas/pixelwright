import { extname } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSET_CLASSIFIER } from "@/core/design/assets/asset-classifier.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { ASSET_FIGMA, ASSET_KIND, ASSET_TEXT } from "@/core/design/assets/assets.constants.ts";
import type { AssetClass, PlannedFile } from "@/core/design/assets/assets.types.ts";
import { SLUG } from "@/core/kernel/names/slug.ts";
import { ASSET_FILE_FORMAT, ASSET_RENDER } from "@/server/app/assets/assets.constants.ts";
import type { AssetError } from "@/server/app/assets/assets.types.ts";
import { ASSETS_EXPORT, ASSETS_EXPORT_TEXT } from "@/server/tools/assets-export/assets-export.constants.ts";
import type { AssetsExportInput } from "@/server/tools/assets-export/assets-export.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXPORT_SCALE } from "@/shared/ops/export/export.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** What assets_export writes: the files planned, the layers it cannot write with why, and what to know. */
export interface ExportPlan {
  readonly assets: PlannedFile[];
  readonly errors: AssetError[];
  readonly notes: string[];
}

/** How the layers named are written: as placed, or rendered in a format at a scale or a CSS width. */
type LayerOptions = Pick<AssetsExportInput, "original" | "format" | "scale" | "width">;

/** An image fill with its hash. */
interface ImageFill {
  readonly imageHash: string;
  readonly visible: boolean;
}

/**
 * assets_export's plan (T-194): `nodes` gives one file per layer however often it is named (B-003), its render (its
 * own export settings count), or with original its topmost visible image fill as placed, the others noted (B-004);
 * `from` gives every true asset inside one layer as design_read plans them. A video fill is never a file: the Plugin
 * API cannot export it (B-001).
 */
@injectable()
export class ExportPlanner {
  readonly #readLayers = new ReadLayers();
  readonly #planner;
  readonly #classifier;
  readonly #slug;

  constructor(
    planner = inject(ASSET_PLANNER),
    classifier = inject(ASSET_CLASSIFIER),
    slug = inject(SLUG),
  ) {
    this.#planner = planner;
    this.#classifier = classifier;
    this.#slug = slug;
  }

  /** One file per layer read; a layer that cannot be written goes to errors and the rest go on. */
  layers(reads: readonly ReadModel[], options: LayerOptions): ExportPlan {
    const plan: ExportPlan = { assets: [], errors: [], notes: [] };
    const layers = new Map(reads.map(({ root }) => [root.id, root]));

    for (const layer of layers.values()) {
      try {
        if (options.original) {
          this.#original(layer, plan);
        } else {
          plan.assets.push(this.#render(layer, options));
        }
      } catch (error) {
        plan.errors.push({ node: layer.id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return plan;
  }

  /** Every true asset inside the layer read, as design_read plans them; with original, its images as placed. */
  inside(read: ReadModel, original: boolean): ExportPlan {
    const plan: ExportPlan = { assets: [], errors: [], notes: [] };
    const layers = new Map([...this.#readLayers.walk(read.root)].map(({ layer }) => [layer.id, layer]));

    for (const asset of this.#planner.plan(read).assets()) {
      if (asset.kind === ASSET_KIND.video) {
        plan.errors.push(this.#video(asset.node));
      } else {
        const swap = original && asset.kind === ASSET_KIND.image && asset.imageHash === undefined;
        const top = swap ? this.#top(this.#images(layers.get(asset.node))) : undefined;

        plan.assets.push(top === undefined ? asset : { ...asset, imageHash: top.imageHash });
      }
    }

    return plan;
  }

  /** The files with the names `names` gives their layers (B-040): slugged, the extension kept, never out of dir. */
  named(assets: readonly PlannedFile[], names: AssetsExportInput["names"]): PlannedFile[] {
    return assets.map((asset) => {
      const name = names?.[asset.node];

      return name === undefined
        ? asset
        : { ...asset, src: ASSET_TEXT.name(this.#slug.of(name), extname(asset.src).slice(1)) };
    });
  }

  /** A note for each id `names` names that no layer asked for has; a layer that failed is in errors already. */
  unnamed(
    names: AssetsExportInput["names"],
    assets: readonly PlannedFile[],
    errors: readonly AssetError[],
  ): string[] {
    const known = new Set([...assets, ...errors].map(({ node }) => node));

    return Object.keys(names ?? {})
      .filter((id) => !known.has(id))
      .map((id) => ASSETS_EXPORT_TEXT.unnamed(id));
  }

  /** The layer's topmost visible image fill as placed (B-004), the others noted; a video refused (B-001). */
  #original(layer: ReadLayer, plan: ExportPlan): void {
    const images = this.#images(layer);
    const top = this.#top(images);

    if (top === undefined) {
      plan.errors.push(
        this.#hasVideo(layer)
          ? this.#video(layer.id)
          : { node: layer.id, message: ASSETS_EXPORT_TEXT.noImage(layer.id) },
      );

      return;
    }

    plan.assets.push({
      node: layer.id,
      kind: ASSET_KIND.image,
      format: ASSET_FILE_FORMAT.png,
      src: ASSET_TEXT.name(this.#slug.of(layer.name), ASSET_FILE_FORMAT.png.toLowerCase()),
      imageHash: top.imageHash,
    });

    if (images.length > 1) {
      plan.notes.push(ASSETS_EXPORT_TEXT.otherImages(layer.id, images.length - 1));
    }

    if (this.#hasVideo(layer)) {
      plan.notes.push(ASSETS_EXPORT_TEXT.video(layer.id));
    }
  }

  /** The layer rendered: an icon stays an icon in any format, rendered with everything it draws. */
  #render(layer: ReadLayer, { format, scale, width }: LayerOptions): PlannedFile {
    const asset = this.#classifier.classify(layer, null);
    const chosen = format ?? this.#ownFormat(asset);
    const vector = chosen === ASSET_FILE_FORMAT.svg || chosen === ASSET_FILE_FORMAT.pdf;
    // A vector has no pixels to size: it renders at its own size.
    const sized = vector ? undefined : this.#scale(layer, scale, width);
    const own = asset === null || asset.kind === ASSET_KIND.video ? null : asset.kind;

    return {
      node: layer.id,
      kind: own ?? (chosen === ASSET_FILE_FORMAT.svg ? ASSET_KIND.icon : ASSET_KIND.image),
      format: chosen,
      src: ASSET_TEXT.name(this.#slug.of(layer.name), chosen.toLowerCase()),
      ...(sized === undefined ? {} : { scale: sized }),
    };
  }

  /** The format the layer's own export settings ask for: an SVG or a JPG as they say, else PNG. */
  #ownFormat(asset: AssetClass | null): string {
    const own = asset === null || asset.kind === ASSET_KIND.video ? null : asset.format;

    return own === ASSET_FILE_FORMAT.svg || own === ASSET_FILE_FORMAT.jpg ? own : ASSET_FILE_FORMAT.png;
  }

  /** A raster's scale: as given, or from a CSS width, the density in px per CSS px over the layer's own width. */
  #scale(
    layer: ReadLayer,
    scale: number | undefined,
    width: number | undefined,
  ): number | undefined {
    // A line has no width to size by: it renders at the density asked.
    if (width === undefined || layer.width === 0) {
      return scale;
    }

    const density = scale ?? ASSET_RENDER.rasterScale;
    const sized = Math.round(((density * width) / layer.width) * ASSETS_EXPORT.scaleSteps) / ASSETS_EXPORT.scaleSteps;

    if (sized > EXPORT_SCALE.max) {
      const most = Math.floor((layer.width * EXPORT_SCALE.max) / density);

      throw new PixelwrightError(ERROR_CODE.opFailed, ASSETS_EXPORT_TEXT.tooWide(layer.id, layer.width, most, density));
    }

    return sized;
  }

  /** The layer's image fills with a hash, bottom first as Figma lists them. */
  #images(layer: ReadLayer | undefined): ImageFill[] {
    const fills = layer?.fills;

    return (Array.isArray(fills) ? fills : []).flatMap(({ type, imageHash, visible }) =>
      type === ASSET_FIGMA.image && typeof imageHash === "string" ? [{ imageHash, visible: visible ?? true }] : [],
    );
  }

  /** The topmost visible one: Figma paints the last fill on top. */
  #top(images: readonly ImageFill[]): ImageFill | undefined {
    return images.findLast(({ visible }) => visible);
  }

  #hasVideo(layer: ReadLayer): boolean {
    return (
      Array.isArray(layer.fills) &&
      layer.fills.some(({ type, visible }) => type === ASSET_FIGMA.video && (visible ?? true))
    );
  }

  #video(node: string): AssetError {
    return { node, kind: ASSET_KIND.video, message: ASSETS_EXPORT_TEXT.video(node) };
  }
}

export const EXPORT_PLANNER = new InjectionToken<ExportPlanner>("ExportPlanner");
