import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { BASELINE_COMPARISON, BASELINE_FILE_TARGET } from "@/server/app/baselines/baseline-check.port.ts";
import { BASELINE_STORE } from "@/server/app/baselines/baseline-store.ts";
import type { BaselineFile, BaselineVersionSchema } from "@/server/app/baselines/baselines.schema.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { PLUGIN_SESSIONS } from "@/server/app/sessions/plugin-sessions.ts";
import { VERSION_SAVE_TEXT } from "@/server/tools/version-save/version-save.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** The session a version goes to, and a note when `file` names another file than the baselines'. */
export interface VersionTarget {
  readonly session: PluginSession;
  readonly notes: string[];
}

/**
 * The baselines a version goes with (T-180): they exist, the version goes to their file, each still matches the design,
 * and each records the version once it is saved, unless it was saved again meanwhile.
 */
@injectable()
export class VersionBaselines {
  readonly #store;
  readonly #comparison;
  readonly #files;
  readonly #sessions;

  constructor(
    store = inject(BASELINE_STORE),
    comparison = inject(BASELINE_COMPARISON),
    files = inject(BASELINE_FILE_TARGET),
    sessions = inject(PLUGIN_SESSIONS),
  ) {
    this.#store = store;
    this.#comparison = comparison;
    this.#files = files;
    this.#sessions = sessions;
  }

  async named(names: readonly string[]): Promise<BaselineFile[]> {
    const found: BaselineFile[] = [];

    for (const name of names) {
      found.push(await this.#store.required(name));
    }

    return found;
  }

  /** The first baseline's file, or the one `file` names; the active file when there are no baselines. */
  target(baselines: readonly BaselineFile[], file: string | undefined): VersionTarget {
    const [first] = baselines;

    return first === undefined
      ? { session: this.#sessions.session(file), notes: [] }
      : this.#files.target(first.file, file);
  }

  /** Refuses the version while a baseline cannot be compared or the design changed since it was saved. */
  async current(baselines: readonly BaselineFile[], session: string): Promise<void> {
    for (const baseline of baselines) {
      const checked = await this.#comparison.compare(baseline, undefined, session);

      if ("reason" in checked) {
        throw new PixelwrightError(ERROR_CODE.opFailed, VERSION_SAVE_TEXT.uncompared(baseline.name, checked.reason));
      }

      if (!checked.diff.same) {
        throw new PixelwrightError(ERROR_CODE.opFailed, VERSION_SAVE_TEXT.changed(baseline.name, checked.diff.counts));
      }
    }
  }

  /** Each baseline records the version, unless it was saved again since it was checked. */
  async stamp(baselines: readonly BaselineFile[],    version: zod.output<typeof BaselineVersionSchema>): Promise<{ names: string[]; notes: string[] }> {
    const names: string[] = [];
    const notes: string[] = [];

    for (const baseline of baselines) {
      const current = await this.#store.read(baseline.name);

      if (current?.capturedAt === baseline.capturedAt) {
        await this.#store.write({ ...current, version });
        names.push(baseline.name);
      } else {
        notes.push(VERSION_SAVE_TEXT.savedAgain(baseline.name));
      }
    }

    return { names, notes };
  }
}

export const VERSION_BASELINES = new InjectionToken<VersionBaselines>("VersionBaselines");
