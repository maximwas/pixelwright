import { basename, extname } from "node:path";
import { inject, injectable } from "@needle-di/core";
import { ASSET_FILES } from "@/server/app/assets/asset-files.ts";
import type { AssetError, WrittenAsset } from "@/server/app/assets/assets.types.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { ASSETS_EXPORT_TEXT } from "@/server/tools/assets-export/assets-export.constants.ts";
import {
  type AssetsExportInput,
  AssetsExportInputSchema,
  type AssetsExportOutput,
} from "@/server/tools/assets-export/assets-export.schema.ts";
import { EXPORT_PLANNER, type ExportPlan } from "@/server/tools/assets-export/export-planner.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * Files out of the design into dir (T-194): the layers named, one entry each (B-003), or every true asset inside one
 * layer; renders, or the images as placed (B-004), a video refused by name (B-001). Each layer is read on its own, so
 * one that cannot be read or written goes to errors and the rest are written (T-195).
 */
@injectable()
export class AssetsExportTool extends Tool<AssetsExportInput, AssetsExportOutput> {
  protected readonly input = AssetsExportInputSchema;
  readonly #session;
  readonly #planner;
  readonly #files;

  constructor(
    session = inject(PLUGIN_SESSION),
    planner = inject(EXPORT_PLANNER),
    files = inject(ASSET_FILES),
  ) {
    super();
    this.#session = session;
    this.#planner = planner;
    this.#files = files;
  }

  protected async run(input: AssetsExportInput): Promise<AssetsExportOutput> {
    this.#refuseMixed(input);

    const plan = await this.#plan(input);
    const assets = this.#planner.named(plan.assets, input.names);
    const { written, errors: unwritten } = await this.#files.write(this.#session, assets, input.dir, input.quality);
    const errors = [...plan.errors, ...unwritten];

    return {
      files: written.map((file) => this.#entry(file)),
      notes: [...this.#renamed(written), ...plan.notes, ...this.#planner.unnamed(input.names, assets, errors)],
      errors,
    };
  }

  #refuseMixed({ nodes, from, original, width }: AssetsExportInput): void {
    if ((nodes === undefined) === (from === undefined)) {
      throw new PixelwrightError(ERROR_CODE.opFailed, ASSETS_EXPORT_TEXT.nodesOrFrom);
    }

    if (width !== undefined && (from !== undefined || original)) {
      throw new PixelwrightError(ERROR_CODE.opFailed, ASSETS_EXPORT_TEXT.widthForNodes);
    }
  }

  /** The layers named, each read on its own (a layer named twice once), or the layer whose assets are written. */
  async #plan(input: AssetsExportInput): Promise<ExportPlan> {
    if (input.from !== undefined) {
      return this.#planner.inside(await this.#read(input.from), input.original);
    }

    const reads: ReadModel[] = [];
    const errors: AssetError[] = [];

    for (const id of new Set(input.nodes)) {
      try {
        reads.push(await this.#read(id));
      } catch (error) {
        errors.push({ node: id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const plan = this.#planner.layers(reads, input);

    return { ...plan, errors: [...errors, ...plan.errors] };
  }

  async #read(id: string): Promise<ReadModel> {
    const {
      reads: [read],
    } = await this.#session.run(readOp, { nodes: [id] });

    if (read === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    return read;
  }

  /** A file as the answer lists it: its format by its extension, the path planned when it got another name. */
  #entry({ node, kind, path, planned, bytes }: WrittenAsset): AssetsExportOutput["files"][number] {
    return {
      node,
      kind,
      format: extname(path).slice(1).toUpperCase(),
      path,
      ...(this.#moved(path, planned) ? { planned } : {}),
      bytes,
    };
  }

  /** Which src to use for each file that got another name than planned. */
  #renamed(written: readonly WrittenAsset[]): string[] {
    return written
      .filter(({ path, planned }) => this.#moved(path, planned))
      .map(({ node, path, planned }) => ASSETS_EXPORT_TEXT.renamed(node, basename(path), basename(planned), path));
  }

  #moved(path: string, planned: string): boolean {
    return basename(path) !== basename(planned);
  }
}
