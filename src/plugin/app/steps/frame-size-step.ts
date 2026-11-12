import { injectable } from "@needle-di/core";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import {
  FRAME_HEADROOM_BYTES,
  FRAME_TEXT,
  UTF8_MAX_UNIT_BYTES,
  UTF8_ONE_BYTE_BELOW,
  UTF8_TWO_BYTES_BELOW,
} from "@/plugin/app/steps/steps.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";

/**
 * Step 7, on the way back (S-006): the encoded answer is measured before it is posted; over the frame cap it becomes
 * RESULT_TOO_LARGE, so the server's maxPayload is only the second fence.
 */
@injectable()
export class FrameSizeStep implements OperationStep {
  async handle(call: OpCall, next: OpNext): Promise<OpResult> {
    const result = await next(call);
    const text = this.#json(result);
    const limit = LIMITS.frameBytes - FRAME_HEADROOM_BYTES;

    if (text === null) {
      return this.#failed(ERROR_CODE.resultNotSerializable, FRAME_TEXT.notSerializable(call.contract.name));
    }

    return this.#fits(text, limit)
      ? result
      : this.#failed(ERROR_CODE.resultTooLarge, FRAME_TEXT.tooLarge(call.contract.name, LIMITS.frameBytes));
  }

  #failed(code: string, message: string): OpResult {
    return { ok: false, error: { code, message } };
  }

  #json(result: OpResult): string | null {
    try {
      return JSON.stringify(result);
    } catch {
      return null;
    }
  }

  /** Longer in units than the limit never fits; short enough that every unit could take three bytes always fits. */
  #fits(text: string, limit: number): boolean {
    if (text.length > limit) {
      return false;
    }

    return text.length * UTF8_MAX_UNIT_BYTES <= limit || this.#utf8Bytes(text) <= limit;
  }

  #utf8Bytes(text: string): number {
    let bytes = 0;

    for (let index = 0; index < text.length; index += 1) {
      const unit = text.charCodeAt(index);

      if (unit < UTF8_ONE_BYTE_BELOW) {
        bytes += 1;
      } else if (unit < UTF8_TWO_BYTES_BELOW) {
        bytes += 2;
      } else {
        bytes += UTF8_MAX_UNIT_BYTES;
      }
    }

    return bytes;
  }
}
