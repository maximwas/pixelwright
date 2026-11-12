import { InjectionToken, inject, injectable } from "@needle-di/core";
import { WINDOW_EVENTS } from "@/core/ports/window-events.port.ts";
import type { BusyOp } from "@/shared/window/ui-message.schema.ts";

/**
 * What still runs after its answer (D-06, A§15.10): an op the watchdog answered for, or execute's code past its time.
 * One list for both, so the window shows each of them until its own work ends.
 */
@injectable()
export class BusyOps {
  readonly #window;
  #busy: readonly BusyOp[] = [];

  constructor(window = inject(WINDOW_EVENTS)) {
    this.#window = window;
  }

  /** The op is busy in the window from now until `running` settles, however it settles. */
  until(op: BusyOp, running: Promise<unknown>): void {
    const ended = () => this.#show(this.#busy.filter((item) => item !== op));

    this.#show([...this.#busy, op]);
    void running.then(ended, ended);
  }

  #show(ops: readonly BusyOp[]): void {
    this.#busy = ops;
    this.#window.busy(ops);
  }
}

export const BUSY_OPS = new InjectionToken<BusyOps>("BusyOps");
