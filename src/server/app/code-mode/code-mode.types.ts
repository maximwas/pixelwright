import type { Logger } from "@/core/ports/logger.port.ts";
import type { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolContent } from "@/server/app/tool-runner/tool-runner.ts";

/** An image block of a tool's answer. */
export type ToolImage = Extract<ToolContent, { readonly type: typeof TOOL_CONTENT_TYPE.image }>;

/** A number argument past its schema's bound, and the bound the call ran with instead. */
export type Clamp = { readonly call: string; readonly path: string; readonly given: number; readonly used: number };

/** One execute call: the code, its wall time, the client's cancel, and the call's own log. */
export interface CodeRequest {
  readonly code: string;
  readonly timeoutMs: number;
  /** The file execute was called for: the one every pw call reads that names none. */
  readonly file?: string;
  readonly signal: AbortSignal;
  readonly logger: Logger;
}

/**
 * What a run answers (research §6): the result cut to fit (with its size before, when cut), the logs, why it failed,
 * the pw calls that succeeded by function, the arguments clamped to their bounds, and the image handles it returned
 * past the ones shown.
 */
export type CodeAnswer = {
  readonly result: unknown;
  readonly logs: readonly string[];
  readonly error?: string;
  readonly calls: Readonly<Record<string, number>>;
  readonly clamped?: readonly Clamp[];
  readonly resultChars?: number;
  readonly notShown?: readonly string[];
};

/** The answer, and the images it names, at most four, to follow it. */
export type CodeOutcome = { readonly answer: CodeAnswer; readonly images: readonly ToolImage[] };
