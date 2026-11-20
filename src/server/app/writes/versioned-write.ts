import { InjectionToken, injectable } from "@needle-di/core";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { WRITES_TEXT } from "@/server/app/writes/writes.constants.ts";
import type { SavedVersion } from "@/server/app/writes/writes.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { saveVersionOp } from "@/shared/ops/save-version/save-version.manifest.ts";

/** What a write asks for: the version's title, a dry run, and whether its op has a dry run to probe with. */
export interface VersionRequest {
  readonly title: string | undefined;
  readonly dryRun: boolean;
  readonly probe: boolean;
}

/** A writer's run, dry or real, and how many things a result changes. */
export interface Writer<Result> {
  write(dry: boolean): Promise<Result>;
  changes(result: Result): number;
}

/** The answer, whether it is a dry run's, and the version saved first. */
export interface Written<Result> {
  readonly result: Result;
  readonly dry: boolean;
  readonly version?: SavedVersion;
}

/**
 * The one versioned-write path (A§6.2 step 6, D-41): with a title and no dry run, a probe first says whether the write
 * changes anything; when not, the probe is the answer and no version is saved; else the version, then the write. A
 * save that fails stops the call, so nothing is written without the version it was promised (T-011). An op without a
 * dry run (execute) saves its version unprobed. The probe, the version and the write all go to the call's one file.
 */
@injectable()
export class VersionedWrite {
  async run<Result>(
    session: PluginSession,
    { title, dryRun, probe }: VersionRequest,
    writer: Writer<Result>,
  ): Promise<Written<Result>> {
    if (title === undefined || dryRun) {
      return { result: await writer.write(dryRun), dry: dryRun };
    }

    if (probe) {
      const probed = await writer.write(true);

      if (writer.changes(probed) === 0) {
        return { result: probed, dry: true };
      }
    }

    const version = await this.#save(session, title);

    return { result: await writer.write(false), dry: false, version };
  }

  async #save(session: PluginSession, title: string): Promise<SavedVersion> {
    try {
      const { id } = await session.run(saveVersionOp, { title, description: WRITES_TEXT.before });

      return { id, title };
    } catch (error) {
      throw new PixelwrightError(
        error instanceof PixelwrightError ? error.code : ERROR_CODE.opFailed,
        WRITES_TEXT.notSaved(title, error instanceof Error ? error.message : String(error)),
      );
    }
  }
}

export const VERSIONED_WRITE = new InjectionToken<VersionedWrite>("VersionedWrite");
