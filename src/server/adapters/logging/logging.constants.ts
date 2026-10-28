/** pino's levels, for PIXELWRIGHT_LOG_LEVEL (default info: start, plugin connected or refused, each call, each failure). */
export const LOG_LEVEL = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "fatal",
  silent: "silent",
} as const;

/**
 * Secrets that never reach a log, at the top of a line or one level down: pairing codes, keys and their secrets,
 * proofs, nonces and tokens (plan 3.2). Arguments, results, XML, texts and layer names are never logged at all.
 */
export const REDACTED_PATHS = ["pairingCode", "key", "secret", "proof", "nonce", "token"].flatMap((name) => [
  name,
  `*.${name}`,
]);

export const REDACTED = "[redacted]";

/** The shared log is set aside as `.1` by the first write that finds it past this: big enough for a day of calls. */
export const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** How the shared log is spelled on disk: opened for appending, set aside beside itself. */
export const SHARED_LOG_FILE = { appendFlag: "a", setAside: (path: string) => `${path}.1` } as const;
