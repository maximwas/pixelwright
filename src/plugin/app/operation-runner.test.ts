import { afterEach, describe, expect, it, vi } from "vitest";
import * as zod from "zod/mini";
import { BusyOps } from "@/plugin/app/busy-ops.ts";
import { OpReport } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { type OpCall, type OperationFactory, OperationRunner } from "@/plugin/app/operation-runner.ts";
import { OperationTurns } from "@/plugin/app/operation-turns.ts";
import { ContractStep } from "@/plugin/app/steps/contract-step.ts";
import { TurnStep } from "@/plugin/app/steps/turn-step.ts";
import { WatchdogStep } from "@/plugin/app/steps/watchdog-step.ts";
import { OpCatalog } from "@/shared/ops/op-catalog.ts";
import { OpContract } from "@/shared/ops/op-contract.ts";

/** A stub op: answers its input's `answer`, never settles when it is "hang", throws when it is "throw". */
class StubOperation extends Operation<{ answer: string }, string> {
  protected execute(input: { answer: string }): Promise<string> {
    if (input.answer === "hang") {
      return new Promise(() => undefined);
    }

    if (input.answer === "throw") {
      return Promise.reject(new Error("broke"));
    }

    return Promise.resolve(input.answer);
  }
}

class StubFactory implements OperationFactory {
  create(_call: OpCall): Operation {
    return new StubOperation(new OpReport());
  }
}

const stubOp = new OpContract({
  name: "ping",
  input: zod.strictObject({ answer: zod.string() }),
  output: zod.string(),
  meta: { write: true, dryRun: false, timeoutMs: 1_000, needsAllowEdits: false, turn: "write" },
});

/** The window's events go nowhere: the busy state has its own test (watchdog-step.test.ts). */
const QUIET_WINDOW = { activity: () => undefined, busy: () => undefined };

const runner = () =>
  new OperationRunner(
    new OpCatalog([stubOp]),
    [new ContractStep(), new TurnStep(new OperationTurns()), new WatchdogStep(new BusyOps(QUIET_WINDOW))],
    new StubFactory(),
  );

describe("OperationRunner (A§6.3)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers UNKNOWN_OP for an op the catalog lacks (P-020)", async () => {
    expect(await runner().run("selection", {})).toMatchObject({ ok: false, error: { code: "UNKNOWN_OP" } });
  });

  it('answers OP_FAILED "<op>: invalid input: ..." when the input fails the op\'s schema (P-020)', async () => {
    const result = await runner().run("ping", { answer: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: "OP_FAILED" } });
    expect(result.ok ? "" : result.error.message).toMatch(/^ping: invalid input: /);
  });

  it("wraps what the op gives or throws in the envelope", async () => {
    const steps = runner();

    expect(await steps.run("ping", { answer: "done" })).toEqual({
      ok: true,
      data: "done",
      cuts: [],
      missing: [],
      touched: [],
    });
    expect(await steps.run("ping", { answer: "throw" })).toEqual({
      ok: false,
      error: { code: "OP_FAILED", message: "broke" },
    });
  });

  it("answers TIMEOUT at the resolved timeout and lets the next write run while the first still hangs (D-06)", async () => {
    vi.useFakeTimers();

    const steps = runner();
    const hung = steps.run("ping", { answer: "hang" });
    const after = steps.run("ping", { answer: "next" });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await hung).toMatchObject({ ok: false, error: { code: "TIMEOUT" } });
    expect(await after).toMatchObject({ ok: true, data: "next" });
  });
});
