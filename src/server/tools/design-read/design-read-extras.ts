import { InjectionToken, inject, injectable } from "@needle-di/core";
import { AUTO_LINE_HEIGHTS } from "@/core/css/fonts/auto-line-heights.ts";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { ASSET_KIND } from "@/core/design/assets/assets.constants.ts";
import type { PlannedFile } from "@/core/design/assets/assets.types.ts";
import { ASSET_FILES } from "@/server/app/assets/asset-files.ts";
import type { AssetError } from "@/server/app/assets/assets.types.ts";
import { SCREENSHOTS } from "@/server/app/renders/screenshots.ts";
import type { Shot } from "@/server/app/renders/shot.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import {
  DESIGN_READ_LINE_HEIGHT,
  DESIGN_READ_SHOT,
  DESIGN_READ_TEXT,
} from "@/server/tools/design-read/design-read.constants.ts";
import type { DesignReadInput } from "@/server/tools/design-read/design-read.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { nearbyOp } from "@/shared/ops/nearby/nearby.manifest.ts";
import type { NearbyNotesOutput } from "@/shared/ops/nearby/nearby.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** The read's asset plan, the hint when its files are only planned, and the assets that could not be written. */
interface ReadAssets {
  readonly plan: AssetPlan;
  readonly hint?: string;
  readonly errors?: readonly AssetError[];
}

/**
 * What design_read adds to a read when asked: Auto line heights in px (T-060), the asset files written (T-055), the
 * designer's notes around the screen (T-058) and the layer's image (T-056), the screenshot tool's at scale 1 with
 * effects.
 */
@injectable()
export class DesignReadExtras {
  readonly #lines;
  readonly #shots;
  readonly #planner;
  readonly #files;

  constructor(
    lines = inject(AUTO_LINE_HEIGHTS),
    shots = inject(SCREENSHOTS),
    planner = inject(ASSET_PLANNER),
    files = inject(ASSET_FILES),
  ) {
    this.#lines = lines;
    this.#shots = shots;
    this.#planner = planner;
    this.#files = files;
  }

  /** The read, its Auto line heights in px when asked. */
  model(read: ReadModel, autoLineHeight: DesignReadInput["autoLineHeight"]): ReadModel {
    return autoLineHeight === DESIGN_READ_LINE_HEIGHT.px ? this.#lines.px(read) : read;
  }

  /** The read's assets (T-055): written into dir with each src at its file, or only planned, which the hint says. */
  async assets(
    session: PluginSession,
    model: ReadModel,
    dir: string | undefined,
  ): Promise<ReadAssets> {
    const plan = this.#planner.plan(model);
    const files = plan.assets().filter((asset): asset is PlannedFile => asset.kind !== ASSET_KIND.video);

    if (dir === undefined) {
      return files.length === 0 ? { plan } : { plan, hint: DESIGN_READ_TEXT.notWritten(files.length) };
    }

    const { written, errors } = await this.#files.write(session, files, dir);
    const moved = plan.moved(
      (file) =>
        written.find(({ node, imageHash }) => node === file.node && imageHash === file.imageHash)?.path ?? file.src,
    );

    return errors.length === 0 ? { plan: moved } : { plan: moved, errors };
  }

  /** The notes around the screen holding the layer; a plugin too old for the op is told to update. */
  async nearby(
    session: PluginSession,
    node: string,
    distance: number,
  ): Promise<NearbyNotesOutput> {
    try {
      return await session.run(nearbyOp, { node, distance });
    } catch (error) {
      if (error instanceof PixelwrightError && error.code === ERROR_CODE.unknownOp) {
        throw new PixelwrightError(ERROR_CODE.unknownOp, DESIGN_READ_TEXT.oldPlugin, { cause: error });
      }

      throw error;
    }
  }

  /** The layer's image, fitted inline as screenshot fits it. */
  screenshot(session: PluginSession, node: string): Promise<Shot> {
    return this.#shots.take(session, { node, scale: DESIGN_READ_SHOT.scale, effects: DESIGN_READ_SHOT.effects });
  }
}

export const DESIGN_READ_EXTRAS = new InjectionToken<DesignReadExtras>("DesignReadExtras");
