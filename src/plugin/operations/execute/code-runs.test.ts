import { afterEach, expect, it, vi } from "vitest";
import type { DocumentEvents, NodeChangeRecord } from "@/core/ports/document-events.port.ts";
import type { WindowEvents } from "@/core/ports/window-events.port.ts";
import { BusyOps } from "@/plugin/app/busy-ops.ts";
import { ChangeJournal } from "@/plugin/app/journal/change-journal.ts";
import { CodeRuns } from "@/plugin/operations/execute/code-runs.ts";
import { CODE_RUN, TIMED_OUT } from "@/plugin/operations/execute/execute.constants.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import type { BusyOp, PluginContext } from "@/shared/window/ui-message.schema.ts";

class Window implements WindowEvents {
  readonly shown: (readonly BusyOp[])[] = [];

  activity(): void {}

  busy(ops: readonly BusyOp[]): void {
    this.shown.push(ops);
  }
}

/** Figma's layer changes as the test reports them. */
class ReportedChanges implements DocumentEvents {
  #listener: (changes: readonly NodeChangeRecord[]) => void = () => {};

  start(): void {}

  info(): Promise<PluginInfoUpdate> {
    return Promise.reject(new Error("the journal reads no info"));
  }

  context(): Promise<PluginContext> {
    return Promise.reject(new Error("the journal reads no context"));
  }

  visible(): void {}

  changed(): void {}

  onNodeChanges(listener: (changes: readonly NodeChangeRecord[]) => void): void {
    this.#listener = listener;
  }

  report(id: string): void {
    this.#listener([{ id, name: id, type: "RECTANGLE", change: "created", properties: [], remote: false, page: "P" }]);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

// T-156: a plugin cannot stop code; what it does after its answer is still Pixelwright's, and the window says it runs.
it("answers TIMED_OUT at the code's time; till the code ends it shows busy and its changes stay Pixelwright's, 1 s more", async () => {
  vi.useFakeTimers({ now: 5_000 });

  const events = new ReportedChanges();
  const window = new Window();
  const journal = new ChangeJournal(events, Date);
  let finish: () => void = () => {};
  const code = new Promise<void>((resolve) => {
    finish = resolve;
  });

  journal.start();

  const value = new CodeRuns(journal, new BusyOps(window), Date).value(code, 1_000);

  await vi.advanceTimersByTimeAsync(1_000);

  expect(await value).toBe(TIMED_OUT);
  expect(window.shown).toEqual([[{ op: "execute", since: 5_000 }]]);

  await vi.advanceTimersByTimeAsync(5_000);
  events.report("1:1");
  finish();
  await vi.advanceTimersByTimeAsync(999);
  events.report("1:2");
  await vi.advanceTimersByTimeAsync(2);
  events.report("1:3");

  expect(window.shown).toEqual([[{ op: "execute", since: 5_000 }], []]);
  expect(journal.changes().changes.map(({ id, by }) => [id, by])).toEqual([
    ["1:1", "pixelwright"],
    ["1:2", "pixelwright"],
    ["1:3", "user"],
  ]);
});

// Code that never settles must not hold the window's busy line and the user's changes forever.
it("gives up on code that never ends after CODE_RUN.capMs: busy clears and later changes are the user's", async () => {
  vi.useFakeTimers({ now: 5_000 });

  const events = new ReportedChanges();
  const window = new Window();
  const journal = new ChangeJournal(events, Date);
  const never = new Promise<void>(() => {});

  journal.start();

  const value = new CodeRuns(journal, new BusyOps(window), Date).value(never, 1_000);

  await vi.advanceTimersByTimeAsync(1_000);
  expect(await value).toBe(TIMED_OUT);

  await vi.advanceTimersByTimeAsync(CODE_RUN.capMs / 2);
  events.report("2:1");
  await vi.advanceTimersByTimeAsync(CODE_RUN.capMs);
  events.report("2:2");

  expect(window.shown.at(-1)).toEqual([]);
  expect(journal.changes().changes.map(({ id, by }) => [id, by])).toEqual([
    ["2:1", "pixelwright"],
    ["2:2", "user"],
  ]);
});
