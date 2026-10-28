import type { Container } from "@needle-di/core";
import { OP_CATALOG, OPERATION_RUNNER, OPERATION_STEPS, OperationRunner } from "@/plugin/app/operation-runner.ts";
import { OPERATION_TURNS, OperationTurns } from "@/plugin/app/operation-turns.ts";
import { ContractStep } from "@/plugin/app/steps/contract-step.ts";
import { EditsStep } from "@/plugin/app/steps/edits-step.ts";
import { FrameSizeStep } from "@/plugin/app/steps/frame-size-step.ts";
import { TurnStep } from "@/plugin/app/steps/turn-step.ts";
import { WatchdogStep } from "@/plugin/app/steps/watchdog-step.ts";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";

/**
 * The op runtime's bindings (A§6.3): the catalog, the turn lock, and the runner's steps in their order, outer first:
 * the contract, the Allow edits check, the frame size on the way back, the turn, the watchdog inside the turn.
 */
export class RuntimeProviders {
  register(container: Container): void {
    container
      .bind({ provide: OP_CATALOG, useValue: OP_CONTRACTS })
      .bind({ provide: OPERATION_TURNS, useClass: OperationTurns })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: ContractStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: EditsStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: FrameSizeStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: TurnStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: WatchdogStep })
      .bind({ provide: OPERATION_RUNNER, useClass: OperationRunner });
  }
}
