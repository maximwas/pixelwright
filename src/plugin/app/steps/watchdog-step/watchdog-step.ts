import { injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import { WATCHDOG_TEXT } from "@/plugin/app/steps/watchdog-step/watchdog-step.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

/**
 * Step 4 (D-06): when the handler has not settled by the op's resolved timeout, the call answers TIMEOUT and its turn
 * ends, so one hung Figma call no longer freezes every later call to the file. The handler itself cannot be stopped.
 * No `signal` is passed: the main thread has no DOMException.
 */
@injectable()
export class WatchdogStep implements OperationStep {
  handle(
    call: OpCall,
    next: OpNext,
  ): Promise<OpResult> {
    const meta = call.contract.meta(call.input);

    return pTimeout(next(call), {
      milliseconds: meta.timeoutMs,
      fallback: (): OpResult => ({
        ok: false,
        error: {
          code: ERROR_CODE.timeout,
          message: WATCHDOG_TEXT.timeout(call.contract.name, meta.timeoutMs, meta.write),
        },
      }),
    });
  }
}
