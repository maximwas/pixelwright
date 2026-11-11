import { inject, injectable } from "@needle-di/core";
import { type ConnectedFile, PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSION_TRIES } from "@/server/app/stores/version-tries.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { VERSION_BASELINES } from "@/server/tools/version-save/version-baselines.ts";
import { VERSION_SAVE, VERSION_SAVE_TEXT } from "@/server/tools/version-save/version-save.constants.ts";
import {
  type VersionSaveInput,
  VersionSaveInputSchema,
  type VersionSaveOutput,
} from "@/server/tools/version-save/version-save.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { SAVE_VERSION } from "@/shared/ops/save-version/save-version.constants.ts";
import { saveVersionOp } from "@/shared/ops/save-version/save-version.manifest.ts";

/**
 * version_save (T-180): a named version, saved only when every check passes, in order: the baselines it goes with
 * exist and come from the file, Allow edits is on there, the title was not just tried (T-181), and each baseline still
 * matches the design. The baselines record it. It saves the version itself, so it is no WriteTool (A§6.2 step 6), and
 * it always changes the file's history, so the weekly support sentence may ride on it (T-006).
 */
@injectable()
export class VersionSaveTool extends Tool<VersionSaveInput, VersionSaveOutput> {
  protected readonly input = VersionSaveInputSchema;
  readonly #baselines;
  readonly #link;
  readonly #tries;
  readonly #support;

  constructor(
    baselines = inject(VERSION_BASELINES),
    link = inject(PLUGIN_LINK),
    tries = inject(VERSION_TRIES),
    support = inject(SUPPORT_NOTE),
  ) {
    super();
    this.#baselines = baselines;
    this.#link = link;
    this.#tries = tries;
    this.#support = support;
  }

  protected async run({
    title,
    description,
    baselines: names = [],
    file,
  }: VersionSaveInput): Promise<VersionSaveOutput> {
    const baselines = await this.#baselines.named(names);
    const target = this.#baselines.target(baselines, file);
    const connected = this.#link.files().find(({ session }) => session === target.session.id);

    this.#checkFile(baselines, connected, title);

    const savedAt = this.#tries.claim(target.session.id, title);
    const id = await this.#checkedSave(target.session, title, baselines, this.#description(description, baselines));
    const stamped = await this.#baselines.stamp(baselines, { id, title, savedAt });
    const support = this.#support.due();

    return {
      id,
      title,
      file: { name: connected?.name ?? "", key: connected?.key ?? null },
      baselines: stamped.names,
      notes: [...target.notes, ...stamped.notes, ...(id === null ? [VERSION_SAVE_TEXT.noId] : [])],
      ...(support === null ? {} : { support }),
    };
  }

  /** Every baseline comes from the file the version goes in, and Allow edits is on there. */
  #checkFile(
    baselines: readonly BaselineFile[],
    connected: ConnectedFile | undefined,
    title: string,
  ): void {
    if (connected === undefined) {
      return;
    }

    for (const { name, file } of baselines) {
      if (file.key === null ? file.name !== connected.name : file.key !== connected.key) {
        throw new PixelwrightError(ERROR_CODE.opFailed, VERSION_SAVE_TEXT.otherFile(name, file.name, connected.name));
      }
    }

    if (!connected.allowEdits) {
      throw new PixelwrightError(ERROR_CODE.editsDisabled, VERSION_SAVE_TEXT.editsOff(connected.name, title));
    }
  }

  /** The baselines still match, then the save; the try is noted: a timeout keeps it (the version may be saved). */
  async #checkedSave(
    session: PluginSession,
    title: string,
    baselines: readonly BaselineFile[],
    description: string,
  ): Promise<string | null> {
    let sent = false;

    try {
      await this.#baselines.current(baselines, session.id);
      sent = true;

      return (await session.run(saveVersionOp, { title, description })).id;
    } catch (error) {
      const code = error instanceof PixelwrightError ? error.code : ERROR_CODE.opFailed;

      // Only a timeout of the save itself keeps the try; the baseline read sent nothing to Figma.
      if (!sent || code !== ERROR_CODE.timeout) {
        this.#tries.forget(session.id, title);
      }

      if (code === ERROR_CODE.timeout || code === ERROR_CODE.editsDisabled) {
        throw error;
      }

      throw new PixelwrightError(
        code,
        VERSION_SAVE_TEXT.notSaved(error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** The given text, a line per baseline it goes with, who saved it; cut to Figma's length. No local paths. */
  #description(given: string | undefined, baselines: readonly BaselineFile[]): string {
    const lines = baselines
      .slice(0, VERSION_SAVE.namedBaselines)
      .map(({ name, node }) => VERSION_SAVE_TEXT.baselineLine(name, node.name, node.id));
    const more = baselines.length - VERSION_SAVE.namedBaselines;

    return [
      ...(given === undefined ? [] : [given, ""]),
      ...lines,
      ...(more > 0 ? [VERSION_SAVE_TEXT.more(more)] : []),
      VERSION_SAVE_TEXT.savedBy,
    ]
      .join(VERSION_SAVE.lineBreak)
      .slice(0, SAVE_VERSION.descriptionChars);
  }
}
