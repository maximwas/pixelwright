import { InjectionToken, inject, injectable } from "@needle-di/core";
import { type ConnectedFile, PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { PLUGIN_SESSIONS } from "@/server/app/sessions/plugin-sessions.ts";
import { BASELINE_DIFF_TEXT } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** The session a baseline is compared in, and a note when it is not the file the baseline came from. */
export interface Target {
  readonly session: PluginSession;
  readonly notes: string[];
}

/**
 * The connected file a baseline is compared in (T-207): the one `file` names, with a note when the baseline came from
 * another; else the file it came from, found by its key, else by its name. Node ids repeat across files, so never the
 * active file by default.
 */
@injectable()
export class BaselineTarget {
  readonly #link;
  readonly #sessions;

  constructor(link = inject(PLUGIN_LINK), sessions = inject(PLUGIN_SESSIONS)) {
    this.#link = link;
    this.#sessions = sessions;
  }

  target(came: BaselineFile["file"], file: string | undefined): Target {
    if (file === undefined) {
      return { session: this.#sessions.session(this.#cameFrom(came)), notes: [] };
    }

    const session = this.#sessions.session(file);
    const connected = this.#link.files().find((each) => each.session === session.id);
    const differs = connected !== undefined && (connected.name !== came.name || connected.key !== came.key);

    return { session, notes: differs ? [BASELINE_DIFF_TEXT.comparedIn(connected.name, came.name)] : [] };
  }

  /** The connected file `file` names (a session from status, or a file name); none, or several, is an error. */
  connected(file: string): ConnectedFile | undefined {
    const session = this.#sessions.session(file);

    return this.#link.files().find((each) => each.session === session.id);
  }

  /** The session of the file a baseline came from: by its key when Figma gave one, else by its one name. */
  #cameFrom({ name, key }: BaselineFile["file"]): string {
    const files = this.#link.files();

    if (key !== null) {
      const byKey = files.find((connected) => connected.key === key);

      if (byKey === undefined) {
        throw new PixelwrightError(ERROR_CODE.fileNotFound, BASELINE_DIFF_TEXT.keyNotConnected(name, key));
      }

      return byKey.session;
    }

    const byName = files.filter((connected) => connected.name === name);
    const [only, second] = byName;

    if (second !== undefined) {
      throw new PixelwrightError(
        ERROR_CODE.ambiguousFile,
        BASELINE_DIFF_TEXT.ambiguous(
          name,
          byName.map(({ session }) => session),
        ),
      );
    }

    if (only === undefined) {
      throw new PixelwrightError(ERROR_CODE.fileNotFound, BASELINE_DIFF_TEXT.notConnected(name));
    }

    return only.session;
  }
}

export const BASELINE_TARGET = new InjectionToken<BaselineTarget>("BaselineTarget");
