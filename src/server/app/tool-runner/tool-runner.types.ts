import type { Logger } from "../../../core/ports/logger.port.ts";
import type { CallId } from "./call-id.ts";
import type { Tool } from "./tool.ts";
import type { ToolManifest } from "./tool-manifest.types.ts";

/** A tool call as the MCP endpoint hands it over: arguments already checked by the SDK against the input schema. */
export interface ToolRequest {
  readonly manifest: ToolManifest;
  readonly args: unknown;
  readonly signal: AbortSignal;
}

/** One call on its way through the runner's steps. */
export interface ToolCall extends ToolRequest {
  readonly callId: CallId;
}

/** What a call answers, in the shape of an MCP CallToolResult. */
export interface ToolAnswer {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly structuredContent?: Readonly<Record<string, unknown>>;
  readonly isError?: boolean;
}

export type ToolStepNext = (call: ToolCall) => Promise<ToolAnswer>;

/** One link of the runner's chain: does its part around the call, and passes it on with next. */
export interface ToolCallStep {
  handle(call: ToolCall, next: ToolStepNext): Promise<ToolAnswer>;
}

/** What one call knows about itself; a tool injects it. */
export interface ToolContext {
  readonly callId: CallId;
  /** Lines it writes carry the tool and the callId. */
  readonly logger: Logger;
  /** The client gave up: stop before the next plugin round (T-014). */
  readonly signal: AbortSignal;
}

/** Builds a fresh tool for one call, with that call's context. */
export interface ToolFactory {
  create(manifest: ToolManifest, context: ToolContext): Promise<Tool>;
}
