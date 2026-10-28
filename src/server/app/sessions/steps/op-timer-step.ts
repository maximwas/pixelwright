import { injectable } from "@needle-di/core";
import type { OpCall, OpCallStep, OpStepNext } from "@/server/app/sessions/plugin-session.ts";
import { OP_TIMEOUT_TEXT } from "@/server/app/sessions/steps/steps.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * An op's timeout as the user reads it (S-009, A§6.5): the link keeps the deadline from the op's resolved timeout;
 * whoever gave up (the plugin's watchdog, the owner, this server), a TIMEOUT is worded by the op's meta. A write may
 * still be running, since a plugin cannot cancel one; a read only did not answer in time.
 */
@injectable()
export class OpTimerStep implements OpCallStep {
  async handle(call: OpCall, next: OpStepNext): Promise<unknown> {
    try {
      return await next(call);
    } catch (error) {
      if (error instanceof PixelwrightError && error.code === ERROR_CODE.timeout) {
        throw new PixelwrightError(
          ERROR_CODE.timeout,
          call.meta.write ? OP_TIMEOUT_TEXT.write : OP_TIMEOUT_TEXT.read(call.meta.timeoutMs),
          { cause: error },
        );
      }

      throw error;
    }
  }
}
