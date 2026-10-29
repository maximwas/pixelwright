import { InjectionToken, injectable } from "@needle-di/core";
import { BUSY_TEXT, MS_PER_SECOND } from "@/plugin-ui/view/view.constants.ts";
import type { BusyOp } from "@/shared/window/ui-message.schema.ts";

/**
 * What still runs in main past its answer (D-06): the watchdog answered TIMEOUT and freed the queue, but Figma's call
 * goes on. The window says so in one status sentence (A§15.10), for the op that has run longest.
 */
@injectable()
export class BusyState {
  #ops: readonly BusyOp[] = [];

  /** Main's list, whole each time: an empty one once nothing runs past its answer. */
  show(ops: readonly BusyOp[]): void {
    this.#ops = ops;
  }

  busy(): boolean {
    return this.#ops.length > 0;
  }

  /** "Busy: <op> since N s", in whole seconds since that op started, or null. */
  line(now: number): string | null {
    const oldest = this.#ops.reduce<BusyOp | null>(
      (first, op) => (first === null || op.since < first.since ? op : first),
      null,
    );

    return oldest === null
      ? null
      : BUSY_TEXT.line(oldest.op, Math.max(0, Math.floor((now - oldest.since) / MS_PER_SECOND)));
  }
}

export const BUSY_STATE = new InjectionToken<BusyState>("BusyState");
