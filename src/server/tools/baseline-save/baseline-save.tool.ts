import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { BASELINE_CAPTURE } from "@/server/app/stores/baseline-capture.ts";
import { SEEN_DESIGNS } from "@/server/app/stores/seen-designs.ts";
import { BASELINE_TEXT } from "@/server/app/stores/stores.constants.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { BASELINE_KEEPER, type CodePaths } from "@/server/tools/baseline-save/baseline-keeper.ts";
import { BASELINE_SAVE_TEXT } from "@/server/tools/baseline-save/baseline-save.constants.ts";
import {
  type BaselineSaveInput,
  BaselineSaveInputSchema,
  type BaselineSaveOutput,
} from "@/server/tools/baseline-save/baseline-save.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * baseline_save (T-200..T-203): keeps a baseline in the project, of a layer read now (a new name, or `replace`), of the
 * design a baseline_diff compared (`accept`: nothing is read, D-39), or only a new file list (`code` alone). An
 * existing name is never written over without one of them. The project is checked before Figma is asked anything.
 */
@injectable()
export class BaselineSaveTool extends Tool<BaselineSaveInput, BaselineSaveOutput> {
  protected readonly input = BaselineSaveInputSchema;
  readonly #session;
  readonly #capture;
  readonly #keeper;
  readonly #seen;

  constructor(
    session = inject(PLUGIN_SESSION),
    capture = inject(BASELINE_CAPTURE),
    keeper = inject(BASELINE_KEEPER),
    seen = inject(SEEN_DESIGNS),
  ) {
    super();
    this.#session = session;
    this.#capture = capture;
    this.#keeper = keeper;
    this.#seen = seen;
  }

  protected async run(input: BaselineSaveInput): Promise<BaselineSaveOutput> {
    const root = await this.#keeper.root();
    const code = input.code === undefined ? undefined : this.#keeper.code(input.code, root);

    if (input.accept !== undefined) {
      return this.#accept(input, input.accept, code);
    }

    const existing = input.name === undefined ? null : await this.#keeper.existing(input.name, input.replace);
    const codeAlone = input.node === undefined && !input.replace && input.file === undefined;

    if (existing !== null && code !== undefined && codeAlone) {
      return this.#keeper.write({ ...existing, code: code.paths }, code.notes);
    }

    return this.#saveRead(input, code);
  }

  /** The layer read now and kept; a name already kept is refused unless replace starts it over. */
  async #saveRead(input: BaselineSaveInput, code: CodePaths | undefined): Promise<BaselineSaveOutput> {
    const captured = await this.#capture.capture(this.#session, input.node, input.name);

    if ("hidden" in captured) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_SAVE_TEXT.hidden(captured.hidden));
    }

    const { baseline, notes } = captured;
    const existing = await this.#keeper.existing(baseline.name, input.replace);

    if (existing !== null && !input.replace) {
      throw new PixelwrightError(
        ERROR_CODE.opFailed,
        BASELINE_SAVE_TEXT.exists(
          baseline.name,
          existing.node.name,
          existing.node.id,
          BASELINE_TEXT.utc(existing.capturedAt),
        ),
      );
    }

    return this.#keeper.write(
      { ...baseline, code: code?.paths ?? existing?.code ?? [] },
      [...(code?.notes ?? []), ...notes],
      existing ?? undefined,
    );
  }

  /** The design a diff compared, kept exactly as it was compared: nothing is read (T-202). */
  async #accept(
    input: BaselineSaveInput,
    accept: string,
    code: CodePaths | undefined,
  ): Promise<BaselineSaveOutput> {
    const { name } = input;

    if (name === undefined || input.node !== undefined || input.replace || input.file !== undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_SAVE_TEXT.acceptAlone);
    }

    const seen = this.#seen.get(accept);

    if (seen === undefined || seen.name !== name) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_SAVE_TEXT.notHeld);
    }

    const stored = await this.#keeper.existing(name, false);

    if (stored === null || stored.capturedAt !== seen.baselineCapturedAt) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_SAVE_TEXT.savedAgain(name));
    }

    const gone = stored.version === null ? [] : [BASELINE_SAVE_TEXT.versionGone(stored.version.title)];

    return this.#keeper.write(
      {
        ...stored,
        capturedAt: seen.capturedAt,
        by: { server: VERSION, plugin: seen.plugin },
        file: seen.file,
        page: seen.page,
        node: seen.node,
        code: code?.paths ?? stored.code,
        version: null,
        snapshot: seen.snapshot,
        tokens: seen.tokens,
      },
      [...(code?.notes ?? []), ...gone],
    );
  }
}
