import { injectable } from "@needle-di/core";
import { RECONNECT } from "@/plugin-ui/link/backoff/backoff.constants.ts";

/**
 * The reconnect waits (P-043): each wait doubles the one before up to the cap, with jitter, and a session the server
 * acknowledged starts the curve over. An endless curve driven by close events, which p-retry's finite attempts are not.
 */
@injectable()
export class Backoff {
  #attempt = 0;

  /** The wait before the next try, in ms; the try after it waits longer. */
  next(): number {
    const base = Math.min(RECONNECT.maxMs, RECONNECT.firstMs * 2 ** this.#attempt);

    this.#attempt += 1;

    return Math.round(base * (RECONNECT.jitterFloor + Math.random()));
  }

  reset(): void {
    this.#attempt = 0;
  }
}
