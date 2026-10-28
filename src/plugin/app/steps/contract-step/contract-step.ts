import { injectable } from "@needle-di/core";
import type { OpCall, OperationStep, OpNext } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import { CONTRACT_TEXT } from "@/plugin/app/steps/contract-step/contract-step.constants.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

/** Step 1 (P-020): the input must pass the op's own schema; the steps after it see only the parsed input. */
@injectable()
export class ContractStep implements OperationStep {
  async handle(
    call: OpCall,
    next: OpNext,
  ): Promise<OpResult> {
    const parsed = call.contract.parseInput(call.input);

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: ERROR_CODE.opFailed,
          message: CONTRACT_TEXT.invalidInput(call.contract.name, parsed.problem),
        },
      };
    }

    return next({
      contract: call.contract,
      input: parsed.data,
    });
  }
}
