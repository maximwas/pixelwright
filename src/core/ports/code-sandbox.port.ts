import { InjectionToken } from "@needle-di/core";

/**
 * What a run may take: its memory and stack in bytes, its CPU between two pauses (a pw call, the end), and the
 * characters of its last log lines kept while it runs.
 */
interface SandboxLimits {
  readonly memoryBytes: number;
  readonly stackBytes: number;
  readonly cpuSliceMs: number;
  readonly logChars: number;
}

/**
 * What a script may read of a pw answer, from its tool's outputSchema: an object's keys (when absent, any key), the
 * shapes of its fields, of an array's items and of a record's values.
 */
export interface AnswerShape {
  readonly keys?: readonly string[];
  readonly fields?: Readonly<Record<string, AnswerShape>>;
  readonly items?: AnswerShape;
  readonly values?: AnswerShape;
}

/** One run: the code as the body of an async function, given `pw`, the `utils` built on it, and `console`. */
export interface SandboxRun {
  readonly code: string;
  /** pw's functions: each `pw.<name>(args)` hands its argument to `call` as plain data and gets plain data back. */
  readonly names: readonly string[];
  /** Each function's answer shape: reading a key it does not have throws; a function without one answers plain data. */
  readonly shapes: Readonly<Record<string, AnswerShape>>;
  readonly call: (name: string, args: unknown) => Promise<unknown>;
  readonly limits: SandboxLimits;
  /** Settles with why when the code must stop at once: pending calls are left behind, and that is the answer's error. */
  readonly stop: Promise<string>;
}

/**
 * What the code returned as plain data (null when it failed), its last log lines (a line longer than logChars by its
 * end), how many lines it logged before them, and why it failed.
 */
export interface SandboxAnswer {
  readonly result: unknown;
  readonly logs: readonly string[];
  readonly earlierLines?: number;
  readonly error?: string;
}

/** Runs model-written JavaScript apart from the server (Code Mode): no Node, no network, no timers; pw, utils, console. */
export interface CodeSandbox {
  run(run: SandboxRun): Promise<SandboxAnswer>;
}

export const CODE_SANDBOX = new InjectionToken<CodeSandbox>("CodeSandbox");
