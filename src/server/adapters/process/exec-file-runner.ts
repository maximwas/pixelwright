import { execFile } from "node:child_process";
import { injectable } from "@needle-di/core";
import type { ProcessResult, ProcessRunner } from "@/core/ports/process-runner.port.ts";
import { PROCESS_RUN } from "@/server/adapters/process/process.constants.ts";

/**
 * The process runner on Node: execFile, so the arguments never pass through a shell except on Windows. It never
 * rejects: a command that cannot start (not on PATH) ends with code null and the reason on stderr.
 */
@injectable()
export class ExecFileRunner implements ProcessRunner {
  run(command: string, args: readonly string[]): Promise<ProcessResult> {
    const options = {
      encoding: PROCESS_RUN.encoding,
      shell: process.platform === PROCESS_RUN.shellPlatform,
      timeout: PROCESS_RUN.timeoutMs,
    };

    return new Promise((resolve) => {
      execFile(command, args, options, (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;

        resolve({ code, stdout, stderr: code === null && error !== null ? stderr + error.message : stderr });
      });
    });
  }
}
