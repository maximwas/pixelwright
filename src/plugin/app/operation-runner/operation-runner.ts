import { inject, injectable } from "@needle-di/core";
import { RUNNER_TEXT } from "@/plugin/app/operation-runner/operation-runner.constants.ts";
import {
  OP_CATALOG,
  OPERATION_FACTORY,
  OPERATION_STEPS,
} from "@/plugin/app/operation-runner/operation-runner.tokens.ts";
import type { OpCall } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

/**
 * Runs one op the server asked for (A§6.3): an op the catalog lacks is UNKNOWN_OP; any other goes through the steps,
 * outer first, and the last hands it to the op built for this call. It answers with the envelope and never throws.
 */
@injectable()
export class OperationRunner {
  readonly #catalog;
  readonly #steps;
  readonly #factory;

  constructor(
    catalog = inject(OP_CATALOG),
    steps = inject(OPERATION_STEPS, { multi: true }),
    factory = inject(OPERATION_FACTORY),
  ) {
    this.#catalog = catalog;
    this.#steps = steps;
    this.#factory = factory;
  }

  async run(
    op: string,
    input: unknown,
  ): Promise<OpResult> {
    const contract = this.#catalog.find(op);

    if (contract === undefined) {
      return {
        ok: false,
        error: {
          code: ERROR_CODE.unknownOp,
          message: RUNNER_TEXT.unknownOp(op),
        },
      };
    }

    return this.#step(0, {
      contract,
      input,
    });
  }

  #step(
    index: number,
    call: OpCall,
  ): Promise<OpResult> {
    const step = this.#steps[index];

    return step === undefined
      ? this.#factory.create(call).run(call.input)
      : step.handle(call, (next) => this.#step(index + 1, next));
  }
}
