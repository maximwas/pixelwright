import { inject, injectable } from "@needle-di/core";
import { WINDOW_EVENTS } from "@/core/ports/window-events.port.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { ACTIVITY_OUTCOME } from "@/shared/window/ui-message.constants.ts";
import type { ActivityEntry } from "@/shared/window/ui-message.schema.ts";

/**
 * Step 1, outermost (P-051): every op's answer goes to the window, a write refused while Allow edits
 * is off and a call its contract refused included; a quiet op (ping, the status probe) never does (O-027).
 */
@injectable()
export class ActivityStep implements OperationStep {
  readonly #window;

  constructor(window = inject(WINDOW_EVENTS)) {
    this.#window = window;
  }

  async handle(call: OpCall, next: OpNext): Promise<OpResult> {
    const result = await next(call);

    // The declared flag, not meta(): out here the input has not passed its schema, and meta's arrows read it.
    if (!(call.contract.declared.quiet ?? false)) {
      this.#window.activity({ op: call.contract.name, outcome: this.#outcome(result) });
    }

    return result;
  }

  #outcome(result: OpResult): ActivityEntry["outcome"] {
    if (!result.ok) {
      return result.error.code === ERROR_CODE.editsDisabled ? ACTIVITY_OUTCOME.refused : ACTIVITY_OUTCOME.failed;
    }

    // Code that threw or ran past its time still answers (execute): its error is in the data.
    return this.#carriesError(result.data) ? ACTIVITY_OUTCOME.failed : ACTIVITY_OUTCOME.done;
  }

  #carriesError(data: unknown): boolean {
    return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string";
  }
}
