/**
 * How the runner starts a command: its output as text; through a shell on Windows only, where npm installs `claude`
 * and `codex` as .cmd files that only a shell starts; and stopped after a minute, so a hung client never holds the setup.
 */
export const PROCESS_RUN = { encoding: "utf8", shellPlatform: "win32", timeoutMs: 60_000 } as const;
