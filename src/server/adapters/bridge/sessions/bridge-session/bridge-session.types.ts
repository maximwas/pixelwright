/** The connection behind a session: the registry closes it when the same window says hello again. */
export interface SessionSocket {
  /** One frame to the plugin: the session's RPC. */
  send(text: string): void;
  close(code: number, reason: string): void;
}
