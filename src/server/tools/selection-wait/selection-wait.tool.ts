import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTEXT } from "@/server/app/tool-runner/tool-runner.ts";
import { SELECTION_WAIT_SECONDS } from "@/server/tools/selection-wait/selection-wait.constants.ts";
import {
  type SelectionWaitInput,
  SelectionWaitInputSchema,
  type SelectionWaitOutput,
} from "@/server/tools/selection-wait/selection-wait.schema.ts";
import { SELECTION_WAIT } from "@/shared/ops/selection-wait/selection-wait.constants.ts";
import { selectionWaitOp } from "@/shared/ops/selection-wait/selection-wait.manifest.ts";

/**
 * Waits until the user selects something else in the call's file (T-031), in rounds the bridge allows (a request lives
 * 30 s), each from the selection the first round began from, until the timeout or the client's abort (T-014).
 */
@injectable()
export class SelectionWaitTool extends Tool<SelectionWaitInput, SelectionWaitOutput> {
  protected readonly input = SelectionWaitInputSchema;
  readonly #session;
  readonly #context;
  readonly #clock;

  constructor(
    session = inject(PLUGIN_SESSION),
    context = inject(TOOL_CONTEXT),
    clock = inject(CLOCK),
  ) {
    super();
    this.#session = session;
    this.#context = context;
    this.#clock = clock;
  }

  protected run({ timeout }: SelectionWaitInput): Promise<SelectionWaitOutput> {
    return this.#rounds(this.#clock.now() + timeout * SELECTION_WAIT_SECONDS.perSecond, null);
  }

  /** One round, then the next from where the first began, until the user selects, the time is up or the client left. */
  async #rounds(deadline: number, from: string[] | null): Promise<SelectionWaitOutput> {
    const round = await this.#session.run(selectionWaitOp, { timeoutMs: this.#roundMs(deadline), from });

    // The client gave up on the call: no more rounds for nobody to read.
    return round.changed || this.#clock.now() >= deadline || this.#context.signal.aborted
      ? { changed: round.changed, nodes: round.nodes }
      : await this.#rounds(deadline, round.from);
  }

  /** What is left of the wait, one round at most. */
  #roundMs(deadline: number): number {
    return Math.max(
      SELECTION_WAIT.shortestRoundMs,
      Math.round(Math.min(SELECTION_WAIT.roundMs, deadline - this.#clock.now())),
    );
  }
}
