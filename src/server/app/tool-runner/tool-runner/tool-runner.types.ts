import type { Logger } from "@/core/ports/logger/logger.port.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session/plugin-session.ts";
import type { CallId } from "@/server/app/tool-runner/call-id/call-id.ts";
import type { Tool } from "@/server/app/tool-runner/tool/tool.ts";
import type { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";

/** A tool call as the MCP endpoint hands it over: arguments already checked by the SDK against the input schema. */
export interface ToolRequest {
  readonly manifest: ToolManifest;
  readonly args: unknown;
  readonly signal: AbortSignal;
}

/** One call on its way through the runner's steps. */
export interface ToolCall extends ToolRequest {
  readonly callId: CallId;
  /** The file the call works on, bound once by TargetStep for a tool that takes `file` (T-002). */
  readonly session?: PluginSession;
}

/** What a call answers, in the shape of an MCP CallToolResult. */
export interface ToolAnswer {
  readonly content: readonly { readonly type: typeof TOOL_CONTENT_TYPE.text; readonly text: string }[];
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

/** Builds a fresh tool for one call, with that call's context and, for a tool that takes `file`, its session. */
export interface ToolFactory {
  create(manifest: ToolManifest, context: ToolContext, session?: PluginSession): Promise<Tool>;
}
