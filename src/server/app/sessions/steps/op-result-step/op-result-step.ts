import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import type { OpCall, OpCallStep, OpStepNext } from "@/server/app/sessions/plugin-session/plugin-session.types.ts";
import { OP_RESULT_TEXT } from "@/server/app/sessions/steps/op-result-step/op-result-step.constants.ts";
import { OpResultSchema, type WireError } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";

/**
 * The innermost step (T-002): the plugin's answer must be an envelope, and its data must pass the op's output schema
 * before a tool sees it; a failure the plugin answers becomes a PixelwrightError with its code.
 */
@injectable()
export class OpResultStep implements OpCallStep {
  async handle(
    call: OpCall,
    next: OpStepNext,
  ): Promise<unknown> {
    const name = call.contract.name;
    const result = zod.safeParse(OpResultSchema, await next(call));

    if (!result.success) {
      throw new PixelwrightError(ERROR_CODE.opFailed, OP_RESULT_TEXT.badEnvelope(name));
    }

    if (!result.data.ok) {
      throw this.#failure(result.data.error);
    }

    const output = call.contract.parseOutput(result.data.data);

    if (!output.success) {
      throw new PixelwrightError(ERROR_CODE.opFailed, OP_RESULT_TEXT.badOutput(name, output.problem));
    }

    return output.data;
  }

  /** A code this server does not know (a newer plugin's) is kept as OP_FAILED with the plugin's own message. */
  #failure(error: WireError): PixelwrightError {
    const code = zod.safeParse(zod.enum(ERROR_CODE), error.code);

    return new PixelwrightError(code.success ? code.data : ERROR_CODE.opFailed, error.message);
  }
}
