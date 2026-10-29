import { inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import { WINDOW_EVENTS } from "@/core/ports/window-events.port.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import { WATCHDOG_TEXT } from "@/plugin/app/steps/steps.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import type { BusyOp } from "@/shared/window/ui-message.schema.ts";

/**
 * Step 7, innermost (D-06): when the handler has not settled by the op's resolved timeout, the call answers TIMEOUT and
 * its turn ends, so one hung Figma call no longer freezes every later call to the file. The handler itself cannot be
 * stopped: the window shows it busy until it ends (A§15.10). No `signal` is passed: the main thread has no
 * DOMException.
 */
@injectable()
export class WatchdogStep implements OperationStep {
  readonly #window;
  #busy: readonly BusyOp[] = [];

  constructor(window = inject(WINDOW_EVENTS)) {
    this.#window = window;
  }

  handle(call: OpCall, next: OpNext): Promise<OpResult> {
    const meta = call.contract.meta(call.input);
    const since = Date.now();
    const handler = next(call);

    return pTimeout(handler, {
      milliseconds: meta.timeoutMs,
      fallback: (): OpResult => {
        this.#runsOn({ op: call.contract.name, since }, handler);

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

  /** The op is busy in the window from its TIMEOUT until its handler ends. */
  #runsOn(op: BusyOp, handler: Promise<OpResult>): void {
    const ended = () => this.#show(this.#busy.filter((item) => item !== op));

    this.#show([...this.#busy, op]);
    // Operation.run never rejects; a step that broke still ends the busy state.
    void handler.then(ended, ended);
  }

  #show(ops: readonly BusyOp[]): void {
    this.#busy = ops;
    this.#window.busy(ops);
  }
}
