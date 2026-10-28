import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock/clock.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger/logger.port.ts";
import type { OpCall, OpCallStep, OpStepNext } from "@/server/app/sessions/plugin-session/plugin-session.types.ts";
import { OP_LOG } from "@/server/app/sessions/steps/op-log-step/op-log-step.constants.ts";

/** One debug line per op (S-058): its name, session and ms, and whether it failed; never its input or data. */
@injectable()
export class OpLogStep implements OpCallStep {
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
    call: OpCall,
    next: OpStepNext,
  ): Promise<unknown> {
    const started = this.#clock.now();
    const fields = () => ({
      component: LOG_COMPONENT.pluginSession,
      op: call.contract.name,
      session: call.session,
      ms: this.#clock.now() - started,
    });

    try {
      const answer = await next(call);

      this.#logger.debug(OP_LOG.ran, fields());

      return answer;
    } catch (error) {
      this.#logger.debug(OP_LOG.failed, {
        ...fields(),
        err: error,
      });

      throw error;
    }
  }
}
