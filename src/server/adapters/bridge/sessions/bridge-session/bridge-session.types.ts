/** The connection behind a session: the registry closes it when the same window says hello again. */
export interface SessionSocket {
  /** One frame to the plugin: the session's RPC. */
  send(text: string): void;
  close(code: number, reason: string): void;
}

/** The registry's sequence: connecting and coming to the front take the next position, so sessions never tie. */
export interface SessionSequence {
  next(): number;
  /** A session's info changed (S-012): the owner's peers hear it (S-033). */
  changed(): void;
}
