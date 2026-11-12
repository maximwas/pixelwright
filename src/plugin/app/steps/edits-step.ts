import { inject, injectable } from "@needle-di/core";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner.ts";
import { EDITS_TEXT } from "@/plugin/app/steps/steps.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";

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

  async handle(call: OpCall, next: OpNext): Promise<OpResult> {
    const meta = call.contract.meta(call.input);

    if (meta.needsAllowEdits && !(await this.#edits.isOn())) {
      return { ok: false, error: { code: ERROR_CODE.editsDisabled, message: this.#refusal(call, meta.dryRun) } };
    }

    return next(call);
  }

  /** dryRun named only where the op has one; execute's says how to read without the switch. */
  #refusal(call: OpCall, dryRun: boolean): string {
    if (dryRun) {
      return EDITS_TEXT.disabled;
    }

    return call.contract.name === OP_NAME.execute ? EDITS_TEXT.execute : EDITS_TEXT.noDryRun;
  }
}
