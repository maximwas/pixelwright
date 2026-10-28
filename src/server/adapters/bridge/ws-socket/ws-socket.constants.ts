/** How often the server pings each plugin window; one that stayed silent since the last ping is cut off (S-007). */
export const HEARTBEAT_MS = 15_000;

/** The ws events the adapter listens to. */
export const WS_EVENT = {
  message: "message",
  close: "close",
  pong: "pong",
  error: "error",
} as const;

export const WS_LOG = {
  error: "plugin socket error",
  silent: "plugin socket cut off: no answer since the last ping",
} as const;
