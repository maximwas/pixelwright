import { describe, expect, it } from "vitest";
import type { Clock } from "@/core/ports/clock.port.ts";
import type { DocumentEvents, NodeChangeRecord } from "@/core/ports/document-events.port.ts";
import { ChangeJournal } from "@/plugin/app/journal/change-journal.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";
import type { PluginContext } from "@/shared/window/ui-message.schema.ts";

/** Figma's layer changes as the test reports them; the journal reads nothing else of the file. */
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

  report(...changes: NodeChangeRecord[]): void {
    this.#listener(changes);
  }
}

/** Time that moves only when the test moves it. */
class StepClock implements Clock {
  ms = 1_800_000_000_000;

  now(): number {
    return this.ms;
  }
}

const change = (
  id: string,
  kind: NodeChangeRecord["change"] = "changed",
  properties: string[] = [],
): NodeChangeRecord => ({
  id,
  name: id,
  type: "RECTANGLE",
  change: kind,
  properties,
  remote: false,
  page: "Start here",
});

const journaled = () => {
  const events = new ReportedChanges();
  const clock = new StepClock();
  const journal = new ChangeJournal(events, clock);

  journal.start();

  return { events, clock, journal };
};

const whose = (journal: ChangeJournal) => journal.changes().changes.map(({ id, by }) => [id, by]);

describe("ChangeJournal (T-035, D-53)", () => {
  it("holds Figma's reports while a write runs; the ids it touched make theirs Pixelwright's (P-022)", () => {
    const { events, journal } = journaled();
    const ended = journal.writing();

    events.report(change("1:1"), change("1:2"));

    expect(journal.changes().changes).toEqual([]);

    ended(["1:1"]);

    expect(whose(journal)).toEqual([
      ["1:1", "pixelwright"],
      ["1:2", "user"],
    ]);
  });

  it("keeps a touched layer Pixelwright's for 90 s until its first report: a later one is the user's (FX-010)", () => {
    const { events, clock, journal } = journaled();

    journal.writing()(["1:1", "1:2"]);
    clock.ms += 89_000;
    events.report(change("1:1"));
    events.report(change("1:1", "changed", ["x"]));
    clock.ms += 2_000;
    events.report(change("1:2"));

    expect(whose(journal)).toEqual([
      ["1:1", "pixelwright"],
      ["1:1", "user"],
      ["1:2", "user"],
    ]);
  });

  it("tells nothing of a layer one hand made and deleted before an answer listed it", () => {
    const { events, journal } = journaled();

    events.report(change("1:1", "created"));
    events.report(change("1:1", "deleted"));

    expect(journal.changes().changes).toEqual([]);

    events.report(change("1:2", "created"));
    journal.changes();
    events.report(change("1:2", "deleted"));

    expect(journal.changes().changes.map(({ id, change: kind }) => [id, kind])).toEqual([["1:2", "deleted"]]);
  });

  it("merges a layer's run of changes by one hand: a created layer stays created, its properties together", () => {
    const { events, journal } = journaled();

    events.report(change("1:1", "created", ["fills"]));
    events.report(change("1:1", "changed", ["width", "fills"]));
    events.report(change("1:2", "changed", ["x"]), { ...change("1:2", "changed", ["y"]), remote: true });

    expect(
      journal.changes().changes.map(({ id, change: kind, properties, by }) => ({ id, kind, properties, by })),
    ).toEqual([
      { id: "1:1", kind: "created", properties: ["fills", "width"], by: "user" },
      { id: "1:2", kind: "changed", properties: ["x"], by: "user" },
      { id: "1:2", kind: "changed", properties: ["y"], by: "collaborator" },
    ]);
  });

  it("drops the oldest past 5,000 entries and tells a cursor from before them, or a foreign one, it missed some", () => {
    const { events, journal } = journaled();
    const { cursor } = journal.changes();

    events.report(...[...Array(5_001).keys()].map((index) => change(`1:${index}`)));

    const after = journal.changes(cursor);

    expect(after.truncated).toBe(true);
    expect(after.changes).toHaveLength(5_000);
    expect(after.changes[0]?.id).toBe("1:1");
    expect(journal.changes(after.cursor).truncated).toBe(false);
    expect(journal.changes(1).truncated).toBe(true);
  });

  it("keeps execute's window open while either of two runs, and 1 s after the last ends (A§15.9)", () => {
    const { events, clock, journal } = journaled();
    const first = journal.executing();
    const second = journal.executing();

    first();
    clock.ms += 5_000;
    events.report(change("1:1"));
    second();
    clock.ms += 999;
    events.report(change("1:2"));
    clock.ms += 2;
    events.report(change("1:3"));

    expect(whose(journal)).toEqual([
      ["1:1", "pixelwright"],
      ["1:2", "pixelwright"],
      ["1:3", "user"],
    ]);
  });
});
