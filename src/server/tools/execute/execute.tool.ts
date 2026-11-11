import { readFile, stat } from "node:fs/promises";
import { inject, injectable } from "@needle-di/core";
import type { CodeAnswer, ToolImage } from "@/server/app/code-mode/code-mode.types.ts";
import { CODE_RUNNER } from "@/server/app/code-mode/code-runner.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import { TOOL_CONTEXT, type ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { EXECUTE_CODE_PATH, EXECUTE_SECONDS, EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { type ExecuteInput, ExecuteInputSchema, type ExecuteOutput } from "@/server/tools/execute/execute.schema.ts";
import { ReadsOnlyCheck } from "@/server/tools/execute/reads-only-check.ts";
import { SyntaxCheck } from "@/server/tools/execute/syntax-check.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

/** What a call answers: the plugin's or the script's answer, and the images a script returned the handles of. */
type ExecuteRun = { readonly output: ExecuteOutput | CodeAnswer; readonly images: readonly ToolImage[] };

/**
 * One of three. The code, or a codePath file's, run in the plugin of the call's file (T-150): checked for syntax
 * first, so code cut on its way here is told so before it runs (T-152, B-006); the note decided from the code once it
 * ran (T-153); the op's meta makes the server wait a little past the code's own time (T-156). A script runs on the
 * server in the QuickJS sandbox, its pw calls the read tools through the tool runner; the images it names follow the
 * answer.
 */
@injectable()
export class ExecuteTool extends Tool<ExecuteInput, ExecuteRun> {
  protected readonly input = ExecuteInputSchema;
  readonly #session;
  readonly #folder;
  readonly #runner;
  readonly #context;
  readonly #syntax = new SyntaxCheck();
  readonly #reads = new ReadsOnlyCheck();

  constructor(
    session = inject(PLUGIN_SESSION),
    folder = inject(PROJECT_FOLDER),
    runner = inject(CODE_RUNNER),
    context = inject(TOOL_CONTEXT),
  ) {
    super();
    this.#session = session;
    this.#folder = folder;
    this.#runner = runner;
    this.#context = context;
  }

  protected async run({ code, codePath, script, timeout, file }: ExecuteInput): Promise<ExecuteRun> {
    if ([code, codePath, script].filter((field) => field !== undefined).length !== 1) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.oneOf);
    }

    if (script !== undefined) {
      const { signal, logger } = this.#context;
      const seconds = timeout ?? EXECUTE_SECONDS.scriptDefault;
      const { answer, images } = await this.#runner.run({
        code: script,
        timeoutMs: seconds * EXECUTE_SECONDS.perSecond,
        ...(file === undefined ? {} : { file }),
        signal,
        logger,
      });

      return { output: answer, images };
    }

    const source = codePath === undefined ? (code ?? "") : await this.#codeFile(codePath);

    return { output: await this.#plugin(source, timeout ?? EXECUTE_SECONDS.default), images: [] };
  }

  /** The answer's JSON as structuredContent and as text (T-004), then a script's images. */
  protected override answer({ output, images }: ExecuteRun): ToolAnswer {
    return {
      content: [{ type: TOOL_CONTENT_TYPE.text, text: JSON.stringify(output) }, ...images],
      structuredContent: output,
    };
  }

  async #plugin(source: string, seconds: number): Promise<ExecuteOutput> {
    const problem = this.#syntax.problem(source);

    if (problem !== null) {
      return { result: null, logs: [], error: problem };
    }

    const ran = await this.#session.run(executeOp, {
      code: source,
      timeoutMs: Math.round(seconds * EXECUTE_SECONDS.perSecond),
    });

    // From the code, never from change events: a background tab hears of them a minute late (B-033).
    return ran.error === undefined && this.#reads.readsOnly(source) ? { ...ran, note: EXECUTE_TEXT.readsOnly } : ran;
  }

  /**
   * A codePath file read from disk at this very call (T-151), so the file as it is now runs: functions an earlier copy added
   * to pw would keep running the old code otherwise. A relative path starts in the project folder.
   */
  async #codeFile(codePath: string): Promise<string> {
    const path = await this.#folder.resolve(codePath);
    const info = await stat(path).catch(() => null);

    if (info === null || !info.isFile()) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.notAFile(codePath, path));
    }

    // Too many bytes is too many characters, whatever the file holds: it is refused before it is read.
    if (info.size > EXECUTE.codeChars * EXECUTE_CODE_PATH.maxBytesPerChar) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.tooBig(codePath, info.size));
    }

    const text = await readFile(path, EXECUTE_CODE_PATH.encoding);

    if (text.length === 0 || text.length > EXECUTE.codeChars) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.wrongLength(codePath, text.length));
    }

    return text;
  }
}
