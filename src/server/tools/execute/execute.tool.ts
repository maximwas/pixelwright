import { readFile, stat } from "node:fs/promises";
import { inject, injectable } from "@needle-di/core";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { EXECUTE_SCRIPT, EXECUTE_SECONDS, EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { type ExecuteInput, ExecuteInputSchema, type ExecuteOutput } from "@/server/tools/execute/execute.schema.ts";
import { ReadsOnlyCheck } from "@/server/tools/execute/reads-only-check.ts";
import { SyntaxCheck } from "@/server/tools/execute/syntax-check.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

/** The code to run, its time, and what is wrong with its syntax, if anything. */
interface Code {
  readonly source: string;
  readonly timeout: number;
  readonly problem: string | null;
}

/**
 * The code, or the script's, run in the plugin of the call's file (T-150): checked for syntax first, so code cut on
 * its way here is told so before it runs and before any version (T-152, B-006); the note decided from the code once it
 * ran (T-153). Its op has no dry run, so a `version` is saved unprobed (A§6.2 step 6); its changes are not counted and
 * it gives no support sentence (T-006). The op's meta makes the server wait a little past the code's own time (T-156).
 */
@injectable()
export class ExecuteTool extends WriteTool<ExecuteInput, Code, ExecuteOutput, ExecuteOutput> {
  protected readonly input = ExecuteInputSchema;
  protected readonly op = executeOp;
  readonly #folder;
  readonly #syntax = new SyntaxCheck();
  readonly #reads = new ReadsOnlyCheck();

  constructor(
    session = inject(PLUGIN_SESSION),
    folder = inject(PROJECT_FOLDER),
    versioned = inject(VERSIONED_WRITE),
    support = inject(SUPPORT_NOTE),
  ) {
    super(session, versioned, support);
    this.#folder = folder;
  }

  protected async prepare({ code, script, timeout }: ExecuteInput): Promise<Code> {
    const source = await this.#source(code, script);

    return { source, timeout, problem: this.#syntax.problem(source) };
  }

  protected override answerNow({ problem }: Code): ExecuteOutput | undefined {
    return problem === null ? undefined : { result: null, logs: [], error: problem };
  }

  protected async write({ source, timeout }: Code): Promise<ExecuteOutput> {
    const ran = await this.session.run(executeOp, {
      code: source,
      timeoutMs: Math.round(timeout * EXECUTE_SECONDS.perSecond),
    });

    // From the code, never from change events: a background tab hears of them a minute late (B-033).
    return ran.error === undefined && this.#reads.readsOnly(source) ? { ...ran, note: EXECUTE_TEXT.readsOnly } : ran;
  }

  protected changes(): number {
    return 0;
  }

  protected output(result: ExecuteOutput, { version }: WriterOutput): ExecuteOutput {
    return version === undefined ? result : { ...result, version };
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
