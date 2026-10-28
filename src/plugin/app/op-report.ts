import { InjectionToken, injectable } from "@needle-di/core";
import { CALLBACKS_SPENT, ERROR_TEXT } from "@/plugin/app/app.constants.ts";
import type { OpResult, WireError } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** One op call's envelope (D-05), built in the call's own child container: the data, or the error it threw. */
@injectable()
export class OpReport {
  succeeded(data: unknown): OpResult {
    return { ok: true, data, cuts: [], missing: [], touched: [] };
  }

  failed(error: unknown): OpResult {
    return { ok: false, error: this.#describe(error) };
  }

  /** A thrown value as a wire error: an expected failure keeps its code, anything else is OP_FAILED with its message. */
  #describe(error: unknown): WireError {
    const message = error instanceof Error ? error.message : String(error);

    return {
      code: error instanceof PixelwrightError ? error.code : ERROR_CODE.opFailed,
      message: CALLBACKS_SPENT.test(message) ? ERROR_TEXT.reopen(message) : message,
    };
  }
}

export const OP_REPORT = new InjectionToken<OpReport>("OpReport");
