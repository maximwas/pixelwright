import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";
import type { PlannedFile } from "@/core/design/assets/assets.types.ts";
import { WEBP_ENCODER } from "@/core/ports/webp-encoder.port.ts";
import { ASSET_WRITER, type FetchedAsset } from "@/server/app/assets/asset-writer.ts";
import { ASSET_FILE_FORMAT, ASSET_RENDER, WEBP_QUALITY } from "@/server/app/assets/assets.constants.ts";
import type { AssetError, WrittenAsset } from "@/server/app/assets/assets.types.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { EXPORT_PULL } from "@/server/app/renders/export-pull.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { EXPORT_FORMAT } from "@/shared/ops/export/export.constants.ts";

/** What a write of assets gives: the files written, and the layers whose asset was not, with why. */
interface AssetsWritten {
  readonly written: WrittenAsset[];
  readonly errors: AssetError[];
}

/**
 * Asset files out of the design (T-055, T-194, S-100): each asset's bytes from the plugin, an original image by its
 * hash or a render in its format (rasters at 2x unless it says, vectors at their size; an icon with everything it
 * draws, since centred and outside strokes would be cut at its box, an image as its own box), WebP encoded here from
 * Figma's PNG; then written into dir, a relative one from the project folder. An asset that cannot be had goes to
 * errors and the rest are written.
 */
@injectable()
export class AssetFiles {
  readonly #folder;
  readonly #pull;
  readonly #webp;
  readonly #writer;

  constructor(
    folder = inject(PROJECT_FOLDER),
    pull = inject(EXPORT_PULL),
    webp = inject(WEBP_ENCODER),
    writer = inject(ASSET_WRITER),
  ) {
    this.#folder = folder;
    this.#pull = pull;
    this.#webp = webp;
    this.#writer = writer;
  }

  async write(
    session: PluginSession,
    assets: readonly PlannedFile[],
    dir: string,
    quality: number = WEBP_QUALITY.default,
  ): Promise<AssetsWritten> {
    const folder = await this.#folder.resolve(dir);
    const fetched: FetchedAsset[] = [];
    const errors: AssetError[] = [];

    for (const asset of assets) {
      try {
        fetched.push({ asset, bytes: await this.#bytes(session, asset, quality) });
      } catch (error) {
        errors.push({ node: asset.node, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return { written: await this.#writer.write(fetched, { folder, dir }), errors };
  }

  async #bytes(
    session: PluginSession,
    asset: PlannedFile,
    quality: number,
  ): Promise<Uint8Array> {
    if (asset.imageHash !== undefined) {
      return await this.#pull.original(session, asset.node, asset.imageHash);
    }

    const format = Object.values(EXPORT_FORMAT).find((known) => known === asset.format) ?? EXPORT_FORMAT.png;
    const vector = format === EXPORT_FORMAT.svg || format === EXPORT_FORMAT.pdf;
    const { bytes } = await this.#pull.render(session, {
      node: asset.node,
      format,
      scale: asset.scale ?? (vector ? ASSET_RENDER.vectorScale : ASSET_RENDER.rasterScale),
      effects: asset.kind === ASSET_KIND.icon,
    });

    return asset.format === ASSET_FILE_FORMAT.webp ? await this.#webp.encode(bytes, quality) : bytes;
  }
}

export const ASSET_FILES = new InjectionToken<AssetFiles>("AssetFiles");
