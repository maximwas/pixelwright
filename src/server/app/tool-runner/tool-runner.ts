import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import { LOGGER, type Logger } from "@/core/ports/logger.port.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { CallId } from "@/server/app/tool-runner/call-id.ts";
import type { Tool } from "@/server/app/tool-runner/tool.ts";
import type { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";

/**
 * Runs every tool call through the same chain of steps (Chain of Responsibility): the call gets its id, each step does
 * its part around the rest, and the last link builds the tool for this call and executes it. A new concern (timers,
 * versioned writes) is a new step, not a change here.
 */
@injectable()
export class ToolRunner {
  readonly #steps;
  readonly #tools;
  readonly #logger;

  constructor(
    steps = inject(TOOL_CALL_STEPS, { multi: true }),
    tools = inject(TOOL_FACTORY),
    logger = inject(LOGGER),
  ) {
    this.#steps = steps;
    this.#tools = tools;
    this.#logger = logger;
  }

  run(request: ToolRequest): Promise<ToolAnswer> {
    return this.#handle({ ...request, callId: CallId.next() }, 0);
  }

  #handle(call: ToolCall, index: number): Promise<ToolAnswer> {
    const step = this.#steps[index];

    return step === undefined ? this.#execute(call) : step.handle(call, (next) => this.#handle(next, index + 1));
  }

  async #execute({ manifest, args, callId, signal, session }: ToolCall): Promise<ToolAnswer> {
    const logger = this.#logger.child({ component: LOG_COMPONENT.tool, tool: manifest.name, callId: callId.value });
    const tool = await this.#tools.create(manifest, { callId, logger, signal }, session);

    return tool.execute(args);
  }
}

export const TOOL_RUNNER = new InjectionToken<ToolRunner>("ToolRunner");

export const TOOL_FACTORY = new InjectionToken<ToolFactory>("ToolFactory");

/** The runner's chain, outermost first, in the order the composition root binds them. */
export const TOOL_CALL_STEPS = new InjectionToken<ToolCallStep>("ToolCallSteps");

/** Bound per call in the tool's own child container. */
export const TOOL_CONTEXT = new InjectionToken<ToolContext>("ToolContext");

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
