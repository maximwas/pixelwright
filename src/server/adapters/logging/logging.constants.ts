/** pino's levels, for PIXELWRIGHT_LOG_LEVEL (default info: start, plugin connected or refused, each call, each failure). */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

/**
 * Secrets that never reach a log, at the top of a line or one level down: pairing codes, keys, proofs, nonces and
 * tokens (plan 3.2). Arguments, results, XML, texts and layer names are never logged in the first place.
 */
export const REDACTED_PATHS = ["pairingCode", "key", "proof", "nonce", "token"].flatMap((name) => [name, `*.${name}`]);

export const REDACTED = "[redacted]";
