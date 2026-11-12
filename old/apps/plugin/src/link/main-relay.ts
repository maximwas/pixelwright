import type { RequestOutcome } from "../types/link.ts";

/**
 * Requests from the UI to the main code, each under an id of its own. The server's request ids are not unique across
 * connections (a new server process starts over at 1), so keying answers by them could hand one server's answer to
 * another's request.
 */
export class MainRelay {
  readonly #send: (id: string, op: string, input: unknown) => void;
  readonly #pending = new Map<string, (outcome: RequestOutcome) => void>();
  #next = 0;

  constructor(send: (id: string, op: string, input: unknown) => void) {
    this.#send = send;
  }

  call(op: string, input: unknown): Promise<RequestOutcome> {
    const id = String(++this.#next);

    return new Promise((resolve) => {
      this.#pending.set(id, resolve);
      this.#send(id, op, input);
    });
  }

  /** The main code's answer to one request; an answer nobody waits for is ignored. */
  settle(id: string, outcome: RequestOutcome): void {
    this.#pending.get(id)?.(outcome);
    this.#pending.delete(id);
  }
}
