import type { Container } from "@needle-di/core";
import { CHANGE_JOURNAL, ChangeJournal } from "@/plugin/app/journal/change-journal.ts";
import { OP_CATALOG, OPERATION_RUNNER, OPERATION_STEPS, OperationRunner } from "@/plugin/app/operation-runner.ts";
import { OPERATION_TURNS, OperationTurns } from "@/plugin/app/operation-turns.ts";
import { ActivityStep } from "@/plugin/app/steps/activity-step.ts";
import { ContractStep } from "@/plugin/app/steps/contract-step.ts";
import { EditsStep } from "@/plugin/app/steps/edits-step.ts";
import { FrameSizeStep } from "@/plugin/app/steps/frame-size-step.ts";
import { JournalStep } from "@/plugin/app/steps/journal-step.ts";
import { TurnStep } from "@/plugin/app/steps/turn-step.ts";
import { WatchdogStep } from "@/plugin/app/steps/watchdog-step.ts";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";

/**
 * The op runtime's bindings (A§6.3): the catalog, the turn lock, the change journal, and the runner's steps in their
 * order, outer first: the window's activity of every answer, the contract, the Allow edits check, the frame size on
 * the way back, the turn, the journal's own writes inside the turn, the watchdog innermost.
 */
export class RuntimeProviders {
  register(container: Container): void {
    container
      .bind({ provide: OP_CATALOG, useValue: OP_CONTRACTS })
      .bind({ provide: OPERATION_TURNS, useClass: OperationTurns })
      .bind({ provide: CHANGE_JOURNAL, useClass: ChangeJournal })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: ActivityStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: ContractStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: EditsStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: FrameSizeStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: TurnStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: JournalStep })
      .bind({ provide: OPERATION_STEPS, multi: true, useClass: WatchdogStep })
      .bind({ provide: OPERATION_RUNNER, useClass: OperationRunner });
  }
}
