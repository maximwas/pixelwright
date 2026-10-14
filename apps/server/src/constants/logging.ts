/** pino's numeric levels by name, as `pixelwright logs` prints them. */
export const LOG_LEVEL_NAMES: Readonly<Record<number, string>> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/** ANSI colours of the levels that need attention in `pixelwright logs`. */
export const LOG_LEVEL_COLORS: Readonly<Record<string, string>> = {
  warn: "\u001b[33m",
  error: "\u001b[31m",
  fatal: "\u001b[31m",
};

export const ANSI_RESET = "\u001b[0m";

/** The shared log file is set aside (as .1) once it grows past this, when a process starts. */
export const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * How often `pixelwright logs` checks the file's size as well: a server's logger keeps the file open and writes through
 * it, which a folder watch on macOS does not report.
 */
export const LOG_POLL_MS = 250;

/** How many lines `pixelwright logs` shows from before it started. */
export const LOG_TAIL_LINES = 40;

/** The bridge's events a person following the logs wants to see; the rest stay at debug. */
export const BRIDGE_INFO_EVENTS: ReadonlySet<string> = new Set([
  "plugin connected",
  "plugin disconnected",
  "peer joined",
]);

/** How much of a failed tool call's message the log keeps: its first line, at most this long. */
export const LOGGED_ERROR_CHARS = 300;
