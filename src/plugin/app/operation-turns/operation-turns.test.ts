import { describe, expect, it } from "vitest";
import { OperationTurns } from "@/plugin/app/operation-turns/operation-turns.ts";
import type { OpTurn } from "@/shared/ops/op-meta.types.ts";

/** Takes turns in order and logs when each starts, so a test can end them one by one. */
class TurnLog {
  readonly turns = new OperationTurns();
  readonly started: string[] = [];
  readonly #ends = new Map<string, () => void>();

  take(
    name: string,
    turn: OpTurn,
  ): void {
    void this.turns.take(turn).then((end) => {
      this.started.push(name);
      this.#ends.set(name, end);
    });
  }

  end(name: string): void {
    this.#ends.get(name)?.();
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("OperationTurns (P-021)", () => {
  it("runs reads together, and a write only after every earlier read, alone", async () => {
    const log = new TurnLog();

    log.take("read-1", "read");
    log.take("read-2", "read");
    log.take("write", "write");
    log.take("read-3", "read");
    await settle();
    expect(log.started).toEqual(["read-1", "read-2"]);

    log.end("read-1");
    await settle();
    expect(log.started).toEqual(["read-1", "read-2"]);

    log.end("read-2");
    await settle();
    expect(log.started).toEqual(["read-1", "read-2", "write"]);

    log.end("write");
    await settle();
    expect(log.started).toEqual(["read-1", "read-2", "write", "read-3"]);
  });

  it("never makes a free op wait, even behind a write that holds its turn", async () => {
    const log = new TurnLog();

    log.take("write", "write");
    log.take("ping", "free");
    log.take("read", "read");
    await settle();

    expect([...log.started].sort()).toEqual(["ping", "write"]);
  });
});
