import { inject, injectable } from "@needle-di/core";
import { EDITS_SWITCH } from "@/core/ports/edits-switch/edits-switch.port.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import { EDITS_TEXT } from "@/plugin/app/steps/edits-step/edits-step.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

/**
 * Step 2, the only Allow edits check (P-010, D-07): an op whose resolved meta needs it is refused while the switch is
 * off, whatever the MCP client allowed. No op checks it by hand.
 */
@injectable()
export class EditsStep implements OperationStep {
  readonly #edits;

  constructor(edits = inject(EDITS_SWITCH)) {
    this.#edits = edits;
  }

  async handle(
    call: OpCall,
    next: OpNext,
  ): Promise<OpResult> {
    if (call.contract.meta(call.input).needsAllowEdits && !(await this.#edits.isOn())) {
      return {
        ok: false,
        error: {
          code: ERROR_CODE.editsDisabled,
          message: EDITS_TEXT.disabled,
        },
      };
    }

    return next(call);
  }
}
