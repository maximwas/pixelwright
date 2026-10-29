import { inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import type * as zod from "zod/mini";
import { CURRENT_SELECTION } from "@/plugin/adapters/figma/current-selection.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import type { selectionWaitOp } from "@/shared/ops/selection-wait/selection-wait.manifest.ts";

type SelectionRoundInput = zod.output<typeof selectionWaitOp.input>;

type SelectionRoundOutput = zod.output<typeof selectionWaitOp.output>;

/**
 * One round of selection_wait (T-031, P-111): it ends when the user selects something other than `from` (the selection
 * now when null), or when its time runs out, and says which, with the selection then. The listener goes either way. A
 * background tab's timers run late (FX-010), so a round there may end late.
 */
@injectable()
export class SelectionWaitOperation extends Operation<SelectionRoundInput, SelectionRoundOutput> {
  readonly #selection;

  constructor(report = inject(OP_REPORT), selection = inject(CURRENT_SELECTION)) {
    super(report);
    this.#selection = selection;
  }

  protected async execute({ timeoutMs, from }: SelectionRoundInput): Promise<SelectionRoundOutput> {
    const start = from ?? this.#ids();
    const changed = this.#differs(start) || (await this.#change(start, timeoutMs));

    return { changed, from: start, nodes: this.#selection.nodes() };
  }

  /** Whether the selection changes to one that differs before the time runs out. */
  async #change(start: readonly string[], timeoutMs: number): Promise<boolean> {
    let stop: (() => void) | undefined;
    const changed = new Promise<boolean>((resolve) => {
      stop = this.#selection.onChange(() => {
        if (this.#differs(start)) {
          resolve(true);
        }
      });
    });

    try {
      return await pTimeout(changed, { milliseconds: timeoutMs, fallback: () => false });
    } finally {
      stop?.();
    }
  }

  /** Something is selected, and it is not what the wait began from. */
  #differs(start: readonly string[]): boolean {
    const now = this.#ids();

    return now.length > 0 && (now.length !== start.length || now.some((id, index) => id !== start[index]));
  }

  #ids(): string[] {
    return this.#selection.nodes().map(({ id }) => id);
  }
}
