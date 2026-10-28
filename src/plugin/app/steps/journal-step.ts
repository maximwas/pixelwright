import { inject, injectable } from "@needle-di/core";
import { CHANGE_JOURNAL } from "@/plugin/app/journal/change-journal.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";

/**
 * Inside the turn (P-022, D-53): a write tells the journal it runs, and when it answers, the layers it touched, so
 * what Figma reports of them is Pixelwright's. Nothing waits on the journal, so save_version needs no exception.
 */
@injectable()
export class JournalStep implements OperationStep {
  readonly #journal;

  constructor(journal = inject(CHANGE_JOURNAL)) {
    this.#journal = journal;
  }

  async handle(call: OpCall, next: OpNext): Promise<OpResult> {
    if (!call.contract.meta(call.input).write) {
      return next(call);
    }

    const wrote = this.#journal.writing();
    let touched: readonly string[] = [];

    try {
      const result = await next(call);

      touched = result.ok ? result.touched : [];

      return result;
    } finally {
      wrote(touched);
    }
  }
}
