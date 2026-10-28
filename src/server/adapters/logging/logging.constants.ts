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

// shortcut: config-reader.schema.ts (item 03's folder) still takes the list; phase B of the shape pass gives it
// zod.enum(LOG_LEVEL) and deletes this.
export const LOG_LEVELS = [
  LOG_LEVEL.trace,
  LOG_LEVEL.debug,
  LOG_LEVEL.info,
  LOG_LEVEL.warn,
  LOG_LEVEL.error,
  LOG_LEVEL.fatal,
  LOG_LEVEL.silent,
] as const;

/**
 * Secrets that never reach a log, at the top of a line or one level down: pairing codes, keys and their secrets,
 * proofs, nonces and tokens (plan 3.2). Arguments, results, XML, texts and layer names are never logged at all.
 */
export const REDACTED_PATHS = ["pairingCode", "key", "secret", "proof", "nonce", "token"].flatMap((name) => [
  name,
  `*.${name}`,
]);

export const REDACTED = "[redacted]";
