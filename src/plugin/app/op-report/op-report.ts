import { inject, injectable } from "@needle-di/core";
import { ERROR_DESCRIPTION } from "@/plugin/app/error-description/error-description.tokens.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";

/** One op call's envelope (D-05), built in the call's own child container: the data, or the error it threw. */
@injectable()
export class OpReport {
  readonly #errors;

  constructor(errors = inject(ERROR_DESCRIPTION)) {
    this.#errors = errors;
  }

  succeeded(data: unknown): OpResult {
    return {
      ok: true,
      data,
      cuts: [],
      missing: [],
      touched: [],
    };
  }

  failed(error: unknown): OpResult {
    return {
      ok: false,
      error: this.#errors.describe(error),
    };
  }
}
