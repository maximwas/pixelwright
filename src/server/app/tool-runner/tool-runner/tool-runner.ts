import { inject, injectable } from "@needle-di/core";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger/logger.port.ts";
import { CallId } from "@/server/app/tool-runner/call-id/call-id.ts";
import { TOOL_CALL_STEPS, TOOL_FACTORY } from "@/server/app/tool-runner/tool-runner/tool-runner.tokens.ts";
import type { ToolAnswer, ToolCall, ToolRequest } from "@/server/app/tool-runner/tool-runner/tool-runner.types.ts";

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
    return this.#handle(
      {
        ...request,
        callId: CallId.next(),
      },
      0,
    );
  }

  #handle(
    call: ToolCall,
    index: number,
  ): Promise<ToolAnswer> {
    const step = this.#steps[index];

    return step === undefined ? this.#execute(call) : step.handle(call, (next) => this.#handle(next, index + 1));
  }

  async #execute({ manifest, args, callId, signal }: ToolCall): Promise<ToolAnswer> {
    const logger = this.#logger.child({
      component: LOG_COMPONENT.tool,
      tool: manifest.name,
      callId: callId.value,
    });
    const tool = await this.#tools.create(manifest, {
      callId,
      logger,
      signal,
    });

    return tool.execute(args);
  }
}
