import { afterEach, describe, expect, it, vi } from "vitest";
import * as zod from "zod/mini";
import type { WindowEvents } from "@/core/ports/window-events.port.ts";
import { WatchdogStep } from "@/plugin/app/steps/watchdog-step.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";
import type { BusyOp } from "@/shared/window/ui-message.schema.ts";

class Window implements WindowEvents {
  readonly shown: (readonly BusyOp[])[] = [];

  activity(): void {}

  busy(ops: readonly BusyOp[]): void {
    this.shown.push(ops);
  }
}

// A read whose handler hangs, as one getCSSAsync did for minutes (D-06).
const slowRead = new OpContract({
  name: "selection",
  input: zod.object({}),
  output: zod.unknown(),
  meta: { write: false, dryRun: false, timeoutMs: 1_000, needsAllowEdits: false, turn: "read" },
});
const answered: OpResult = { ok: true, data: null, cuts: [], missing: [], touched: [] };

afterEach(() => {
  vi.useRealTimers();
});

describe("WatchdogStep (D-06)", () => {
  it("answers TIMEOUT at the op's timeout, and shows the op busy from then until its handler ends", async () => {
    vi.useFakeTimers({ now: 5_000 });

    const window = new Window();
    let finish: (result: OpResult) => void = () => {};
    const handler = new Promise<OpResult>((resolve) => {
      finish = resolve;
    });
    const answer = new WatchdogStep(window).handle({ contract: slowRead, input: {} }, async () => await handler);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await answer).toMatchObject({ ok: false, error: { code: "TIMEOUT" } });
    expect(window.shown).toEqual([[{ op: "selection", since: 5_000 }]]);

    finish(answered);
    await vi.runAllTimersAsync();

    expect(window.shown).toEqual([[{ op: "selection", since: 5_000 }], []]);
  });
});
