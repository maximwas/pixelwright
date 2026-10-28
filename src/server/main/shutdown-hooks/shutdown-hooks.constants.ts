/** How long closing may take before the process ends anyway: the bridge's hard close takes 1 s (S-013). */
export const SHUTDOWN_DELAY_MS = 2_000;

/** The shutdown's log line, and why it closed when no signal says so. */
export const SHUTDOWN_LOG = {
  closing: "shutting down",
  crashed: "shutting down after an uncaught error",
  stdinClosed: "stdin closed",
  idle: "nothing left to do",
} as const;

/** stdin's events that mean the MCP client went away. */
export const STDIN_EVENT = {
  end: "end",
  close: "close",
} as const;
