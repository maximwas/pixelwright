import { readFile, stat } from "node:fs/promises";
import { inject, injectable } from "@needle-di/core";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { EXECUTE_SCRIPT, EXECUTE_SECONDS, EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { type ExecuteInput, ExecuteInputSchema, type ExecuteOutput } from "@/server/tools/execute/execute.schema.ts";
import { ReadsOnlyCheck } from "@/server/tools/execute/reads-only-check.ts";
import { SyntaxCheck } from "@/server/tools/execute/syntax-check.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

/**
 * The code, or the script's, run in the plugin of the call's file (T-150): checked for syntax first, so code cut on
 * its way here is told so before it runs (T-152, B-006); the note decided from the code once it ran (T-153). The op's
 * meta makes the server wait a little past the code's own time (T-156).
 */
@injectable()
export class ExecuteTool extends Tool<ExecuteInput, ExecuteOutput> {
  protected readonly input = ExecuteInputSchema;
  readonly #session;
  readonly #folder;
  readonly #syntax = new SyntaxCheck();
  readonly #reads = new ReadsOnlyCheck();

  constructor(session = inject(PLUGIN_SESSION), folder = inject(PROJECT_FOLDER)) {
    super();
    this.#session = session;
    this.#folder = folder;
  }

  protected async run({ code, script, timeout }: ExecuteInput): Promise<ExecuteOutput> {
    const source = await this.#source(code, script);
    const problem = this.#syntax.problem(source);

    if (problem !== null) {
      return { result: null, logs: [], error: problem };
    }

    const ran = await this.#session.run(executeOp, {
      code: source,
      timeoutMs: Math.round(timeout * EXECUTE_SECONDS.perSecond),
    });

    // From the code, never from change events: a background tab hears of them a minute late (B-033).
    return ran.error === undefined && this.#reads.readsOnly(source) ? { ...ran, note: EXECUTE_TEXT.readsOnly } : ran;
  }

  /** The code itself, or the script's: exactly one of them. */
  async #source(code: string | undefined, script: string | undefined): Promise<string> {
    if (code !== undefined && script === undefined) {
      return code;
    }

    if (code === undefined && script !== undefined) {
      return await this.#script(script);
    }

    throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.oneOf);
  }

  /**
   * A script read from disk at this very call (T-151), so the file as it is now runs: functions an earlier copy added
   * to pw would keep running the old code otherwise. A relative path starts in the project folder.
   */
  async #script(script: string): Promise<string> {
    const path = await this.#folder.resolve(script);
    const info = await stat(path).catch(() => null);

    if (info === null || !info.isFile()) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.notAFile(script, path));
    }

    // Too many bytes is too many characters, whatever the file holds: it is refused before it is read.
    if (info.size > EXECUTE.codeChars * EXECUTE_SCRIPT.maxBytesPerChar) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.tooBig(script, info.size));
    }

    const text = await readFile(path, EXECUTE_SCRIPT.encoding);

    if (text.length === 0 || text.length > EXECUTE.codeChars) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.wrongLength(script, text.length));
    }

    return text;
  }
}
