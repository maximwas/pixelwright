/**
 * Whose turn it is in the file. A write runs alone, after every operation before it: a read meanwhile would see it half
 * done (a render in another mode has the layer in that mode for a moment), and a second write, such as the retry of a
 * call the server stopped waiting for, would not find what the first is still making. Reads run beside each other,
 * after the writes before them, so a write never waits for reads that came after it.
 */
export class OperationTurns {
  /** Settles once every operation so far has: the next write waits for it. */
  #all: Promise<unknown> = Promise.resolve();
  /** Settles once every write so far has: the next read waits for it. */
  #writes: Promise<unknown> = Promise.resolve();

  read<T>(task: () => Promise<T>): Promise<T> {
    const turn = this.#writes.then(task);

    this.#all = Promise.all([this.#all, ended(turn)]).then(() => {});

    return turn;
  }

  write<T>(task: () => Promise<T>): Promise<T> {
    const turn = this.#all.then(task);

    this.#all = ended(turn);
    this.#writes = this.#all;

    return turn;
  }
}

/** Settles when the turn has, holding neither its result nor its error: thousands of turns a session keep nothing. */
function ended(turn: Promise<unknown>): Promise<void> {
  return turn.then(
    () => {},
    () => {},
  );
}
