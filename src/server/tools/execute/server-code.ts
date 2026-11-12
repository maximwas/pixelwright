import { readFile, stat } from "node:fs/promises";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { CodeOutcome, CodeRequest } from "@/server/app/code-mode/code-mode.types.ts";
import { CODE_RUNNER } from "@/server/app/code-mode/code-runner.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { EXECUTE_CODE_PATH, EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";

/**
 * What execute does on the server, apart from the plugin: reads a codePath file and runs a script in the sandbox. One
 * root service, so ExecuteTool keeps four dependencies with the versioned write it shares with every writer.
 */
@injectable()
export class ServerCode {
  readonly #folder;
  readonly #runner;

  constructor(folder = inject(PROJECT_FOLDER), runner = inject(CODE_RUNNER)) {
    this.#folder = folder;
    this.#runner = runner;
  }

  /** A script in the QuickJS sandbox, its pw calls the read tools through the tool runner. */
  async script(request: CodeRequest): Promise<CodeOutcome> {
    return await this.#runner.run(request);
  }

  /**
   * A codePath file read from disk at this very call (T-151), so the file as it is now runs: functions an earlier copy added
   * to pw would keep running the old code otherwise. A relative path starts in the project folder.
   */
  async codeFile(codePath: string): Promise<string> {
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

export const SERVER_CODE = new InjectionToken<ServerCode>("ServerCode");
