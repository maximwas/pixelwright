/** How often the shared log is read (B-062, FX-068): a folder watch misses lines written through an open file on macOS. */
export const LOG_POLL_MS = 250;

/** The lines shown before the follow begins, read from at most the file's last 256 KiB. */
export const LOG_TAIL = { lines: 40, bytes: 256 * 1024 } as const;

/** pino-pretty's one-line form: the time of day, the level, the process and the message, its fields after it. */
export const PRETTY_OPTIONS = { translateTime: "SYS:HH:MM:ss", ignore: "hostname", singleLine: true } as const;

export const LOG_READ = { flag: "r", encoding: "utf8", newline: "\n", abort: "abort" } as const;

export const LOGS_TEXT = { following: (file: string) => `— following ${file} (Ctrl+C to stop) —` } as const;
