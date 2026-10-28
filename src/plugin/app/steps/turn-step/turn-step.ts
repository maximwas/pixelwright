import { inject, injectable } from "@needle-di/core";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import { OPERATION_TURNS } from "@/plugin/app/operation-turns/operation-turns.tokens.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";

/** Step 3 (P-021): the call waits for its turn and ends it when the step inside answers, the watchdog's TIMEOUT too. */
@injectable()
export class TurnStep implements OperationStep {
  readonly #turns;

  constructor(turns = inject(OPERATION_TURNS)) {
    this.#turns = turns;
  }

  async handle(
    call: OpCall,
    next: OpNext,
  ): Promise<OpResult> {
    const end = await this.#turns.take(call.contract.meta(call.input).turn);

    try {
      return await next(call);
    } finally {
      end();
    }
  }
}
