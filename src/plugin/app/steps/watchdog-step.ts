import { inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import { BUSY_OPS } from "@/plugin/app/busy-ops.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import { WATCHDOG_TEXT } from "@/plugin/app/steps/steps.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

/**
 * Step 7, innermost (D-06): when the handler has not settled by the op's resolved timeout, the call answers TIMEOUT and
 * its turn ends, so one hung Figma call no longer freezes every later call to the file. The handler itself cannot be
 * stopped: the window shows it busy until it ends (A§15.10). No `signal` is passed: the main thread has no
 * DOMException.
 */
@injectable()
export class WatchdogStep implements OperationStep {
  readonly #busy;

  constructor(busy = inject(BUSY_OPS)) {
    this.#busy = busy;
  }

  handle(call: OpCall, next: OpNext): Promise<OpResult> {
    const meta = call.contract.meta(call.input);
    const since = Date.now();
    const handler = next(call);

    return pTimeout(handler, {
      milliseconds: meta.timeoutMs,
      fallback: (): OpResult => {
        // Operation.run never rejects; a step that broke still ends the busy state.
        this.#busy.until({ op: call.contract.name, since }, handler);

        return {
          ok: false,
          error: {
            code: ERROR_CODE.timeout,
            message: WATCHDOG_TEXT.timeout(call.contract.name, meta.timeoutMs, meta.write),
          },
        };
      },
    });
  }
}
