import { inject, injectable } from "@needle-di/core";
import type { CodeAnswer, ToolImage } from "@/server/app/code-mode/code-mode.types.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import { TOOL_CONTEXT, type ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { EXECUTE_SECONDS, EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { type ExecuteInput, ExecuteInputSchema, type ExecuteOutput } from "@/server/tools/execute/execute.schema.ts";
import { ReadsOnlyCheck } from "@/server/tools/execute/reads-only-check.ts";
import { SERVER_CODE } from "@/server/tools/execute/server-code.ts";
import { SyntaxCheck } from "@/server/tools/execute/syntax-check.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

/** What a call answers: the plugin's or the script's answer, and the images a script returned the handles of. */
type ExecuteRun = {
  readonly output: (ExecuteOutput | CodeAnswer) & WriterOutput;
  readonly images: readonly ToolImage[];
};

/** Plugin code to run and its seconds, or the answer had without the plugin: a script's, or code that does not parse. */
interface Prepared {
  readonly source: string;
  readonly seconds: number;
  readonly now: ExecuteRun | undefined;
}

/**
 * One of three. The code, or a codePath file's, run in the plugin of the call's file (T-150): checked for syntax
 * first, so code cut on its way here is told so before it runs and before any version (T-152, B-006); the note decided
 * from the code once it ran (T-153); the op's meta makes the server wait a little past the code's own time (T-156). Its
 * op has no dry run, so a `version` is saved unprobed (A§6.2 step 6); its changes are not counted and it gives no
 * support sentence (T-006). A script runs on the server in the QuickJS sandbox and is answered before any write, so it
 * never saves a version (one given is refused first) and runs with Allow edits off; the images it names follow the
 * answer.
 */
@injectable()
export class ExecuteTool extends WriteTool<ExecuteInput, Prepared, ExecuteRun, ExecuteRun> {
  protected readonly input = ExecuteInputSchema;
  protected readonly op = executeOp;
  readonly #context;
  readonly #code;
  readonly #syntax = new SyntaxCheck();
  readonly #reads = new ReadsOnlyCheck();

  constructor(
    session = inject(PLUGIN_SESSION),
    versioned = inject(VERSIONED_WRITE),
    context = inject(TOOL_CONTEXT),
    code = inject(SERVER_CODE),
  ) {
    super(session, versioned, null);
    this.#context = context;
    this.#code = code;
  }

  protected async prepare(input: ExecuteInput): Promise<Prepared> {
    const { code, codePath, script, timeout } = input;

    if ([code, codePath, script].filter((field) => field !== undefined).length !== 1) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.oneOf);
    }

    if (script !== undefined) {
      return { source: script, seconds: 0, now: await this.#script(input, script) };
    }

    const source = codePath === undefined ? (code ?? "") : await this.#code.codeFile(codePath);
    const problem = this.#syntax.problem(source);
    const now = problem === null ? undefined : { output: { result: null, logs: [], error: problem }, images: [] };

    return { source, seconds: timeout ?? EXECUTE_SECONDS.default, now };
  }

  protected override answerNow({ now }: Prepared): ExecuteRun | undefined {
    return now;
  }

  protected async write({ source, seconds }: Prepared): Promise<ExecuteRun> {
    const ran = await this.session.run(executeOp, {
      code: source,
      timeoutMs: Math.round(seconds * EXECUTE_SECONDS.perSecond),
    });

    // From the code, never from change events: a background tab hears of them a minute late (B-033).
    const output =
      ran.error === undefined && this.#reads.readsOnly(source) ? { ...ran, note: EXECUTE_TEXT.readsOnly } : ran;

    return { output, images: [] };
  }

  protected changes(): number {
    return 0;
  }

  protected output(result: ExecuteRun, { version }: WriterOutput): ExecuteRun {
    return version === undefined ? result : { ...result, output: { ...result.output, version } };
  }

  /** The answer's JSON as structuredContent and as text (T-004), then a script's images. */
  protected override answer({ output, images }: ExecuteRun): ToolAnswer {
    return {
      content: [{ type: TOOL_CONTENT_TYPE.text, text: JSON.stringify(output) }, ...images],
      structuredContent: output,
    };
  }

  /** A script only reads: a version is refused before it runs, so nothing is saved and Allow edits is not needed. */
  async #script({ timeout, version, file }: ExecuteInput, script: string): Promise<ExecuteRun> {
    if (version !== undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, EXECUTE_TEXT.scriptVersion);
    }

    const { signal, logger } = this.#context;
    const seconds = timeout ?? EXECUTE_SECONDS.scriptDefault;
    const { answer, images } = await this.#code.script({
      code: script,
      timeoutMs: seconds * EXECUTE_SECONDS.perSecond,
      ...(file === undefined ? {} : { file }),
      signal,
      logger,
    });

    return { output: answer, images };
  }
}
