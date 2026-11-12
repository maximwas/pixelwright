import { InjectionToken } from "@needle-di/core";

/** Runs a command and waits for it, execFile-shaped: the setup's `claude` and `codex`, never a shell line of its own. */
export interface ProcessRunner {
  run(command: string, args: readonly string[]): Promise<ProcessResult>;
}

/** How a command ended: its exit code, or null when it could not start (not on PATH); and what it wrote. */
export interface ProcessResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export const PROCESS_RUNNER = new InjectionToken<ProcessRunner>("ProcessRunner");
