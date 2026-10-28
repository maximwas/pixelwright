/** The connection behind a session: the registry closes it when the same window says hello again. */
export interface SessionSocket {
  close(code: number, reason: string): void;
}
