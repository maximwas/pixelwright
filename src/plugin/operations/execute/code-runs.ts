import { InjectionToken, inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { BUSY_OPS } from "@/plugin/app/busy-ops.ts";
import { CHANGE_JOURNAL } from "@/plugin/app/journal/change-journal.ts";
import { TIMED_OUT } from "@/plugin/operations/execute/execute.constants.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";

/**
 * execute's code as it runs (T-156, A§15.9, A§15.10): a plugin cannot stop code, so the answer comes at the code's time
 * and the code runs on. What Figma reports until the code itself ends, and a moment after, is Pixelwright's; code still
 * running at its time shows busy in the window until it ends.
 */
@injectable()
export class CodeRuns {
  readonly #journal;
  readonly #busy;
  readonly #clock;

  constructor(
    journal = inject(CHANGE_JOURNAL),
    busy = inject(BUSY_OPS),
    clock = inject(CLOCK),
  ) {
    this.#journal = journal;
    this.#busy = busy;
    this.#clock = clock;
  }

  /** The code's value, or TIMED_OUT when its time is up first, the code left running. */
  async value(run: Promise<unknown>, timeoutMs: number): Promise<unknown> {
    const since = this.#clock.now();
    const ended = this.#journal.executing();

    void run.then(ended, ended);

    return await pTimeout(run, {
      milliseconds: timeoutMs,
      fallback: () => {
        this.#busy.until({ op: OP_NAME.execute, since }, run);

        return TIMED_OUT;
      },
    });
  }
}

export const CODE_RUNS = new InjectionToken<CodeRuns>("CodeRuns");
