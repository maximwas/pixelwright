import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock/clock.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER, type LogFields } from "@/core/ports/logger/logger.port.ts";
import { CALL_LOG } from "@/server/app/tool-runner/steps/call-log-step/call-log-step.constants.ts";
import type {
  ToolAnswer,
  ToolCall,
  ToolCallStep,
  ToolStepNext,
} from "@/server/app/tool-runner/tool-runner/tool-runner.types.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";

/**
 * The tool-call log (S-058): one line per call with its tool, callId, the file it named and ms. An expected failure
 * logs at warn with its code, a bug at error with its stack. Arguments and results never reach the log.
 */
@injectable()
export class CallLogStep implements ToolCallStep {
  readonly #logger;
  readonly #clock;

  constructor(
    logger = inject(LOGGER),
    clock = inject(CLOCK),
  ) {
    this.#logger = logger;
    this.#clock = clock;
  }

  async handle(
    call: ToolCall,
    next: ToolStepNext,
  ): Promise<ToolAnswer> {
    const started = this.#clock.now();
    const name = call.manifest.name;

    try {
      const answer = await next(call);

      this.#logger.info(CALL_LOG.called(name), this.#fields(call, started));

      return answer;
    } catch (error) {
      const fields = {
        ...this.#fields(call, started),
        err: error,
      };

      if (error instanceof PixelwrightError) {
        this.#logger.warn(CALL_LOG.failed(name), fields);
      } else {
        this.#logger.error(CALL_LOG.failed(name), fields);
      }

      throw error;
    }
  }

  #fields(
    { manifest, callId, args }: ToolCall,
    started: number,
  ): LogFields {
    const file = typeof args === "object" && args !== null && "file" in args ? args.file : undefined;

    return {
      component: LOG_COMPONENT.toolRunner,
      tool: manifest.name,
      callId: callId.value,
      ...(typeof file === "string" ? { file } : {}),
      ms: this.#clock.now() - started,
    };
  }
}
