import { inject } from "@needle-di/core";
import { OP_REPORT } from "@/plugin/app/op-report/op-report.tokens.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";

/**
 * One op's handler (Template Method, A§6.3 steps 5-6): `run` calls the subclass's `execute` and wraps what it gives or
 * throws in the envelope, so `run` never throws. The input has passed the op's schema already.
 */
export abstract class Operation<Input = unknown, Output = unknown> {
  readonly #report;

  constructor(report = inject(OP_REPORT)) {
    this.#report = report;
  }

  async run(input: Input): Promise<OpResult> {
    try {
      return this.#report.succeeded(await this.execute(input));
    } catch (error) {
      return this.#report.failed(error);
    }
  }

  protected abstract execute(input: Input): Promise<Output>;
}
