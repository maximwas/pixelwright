import { injectable } from "@needle-di/core";
import { CALLBACKS_SPENT, ERROR_TEXT } from "@/plugin/app/error-description/error-description.constants.ts";
import type { WireError } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";

/** A thrown value as a wire error: an expected failure keeps its code, anything else is OP_FAILED with its message. */
@injectable()
export class ErrorDescription {
  describe(error: unknown): WireError {
    const message = error instanceof Error ? error.message : String(error);

    return {
      code: error instanceof PixelwrightError ? error.code : ERROR_CODE.opFailed,
      message: CALLBACKS_SPENT.test(message) ? ERROR_TEXT.reopen(message) : message,
    };
  }
}
