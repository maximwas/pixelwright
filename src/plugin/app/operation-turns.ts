import { InjectionToken, injectable } from "@needle-di/core";
import { OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import type { OpTurn } from "@/shared/ops/op-meta.types.ts";

/**
 * The plugin's one turn lock (P-021, kept from 0.7.0; no maintained read/write lock fits, A§12): a write waits for
 * everything before it and runs alone; a read waits for the writes before it and runs beside other reads; a free op
 * never waits. `take` resolves when the turn starts, with the function that ends it.
 */
@injectable()
export class OperationTurns {
  #writes: Promise<void> = Promise.resolve();
  #reads: Promise<void>[] = [];

  async take(turn: OpTurn): Promise<() => void> {
    if (turn === OP_TURN.free) {
      return () => undefined;
    }

    const { done, end } = this.#turn();
    const before =
      turn === OP_TURN.read ? this.#writes : Promise.all([this.#writes, ...this.#reads]).then(() => undefined);

    if (turn === OP_TURN.read) {
      this.#reads.push(done);
      void done.then(() => {
        this.#reads = this.#reads.filter((read) => read !== done);
      });
    } else {
      this.#writes = before.then(() => done);
      this.#reads = [];
    }

    await before;

    return end;
  }

  #turn(): { done: Promise<void>; end: () => void } {
    let end: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      end = resolve;
    });

    return { done, end };
  }
}

export const OPERATION_TURNS = new InjectionToken<OperationTurns>("OperationTurns");
