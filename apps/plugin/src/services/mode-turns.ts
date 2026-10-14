/**
 * Renders in other variable modes, one at a time: two at once (light and dark side by side) would each see the other's
 * mode as the layer's own.
 */
export class ModeTurns {
  /** The mode render running now: the next waits for it. */
  #turn: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const turn = this.#turn.then(task);

    this.#turn = turn.catch(() => {});

    return turn;
  }
}
