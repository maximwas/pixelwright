/** Asking the client for its roots (T-008): once, 5 s at most, and again after it says they changed. */
export const MCP_ROOTS_ASK = { timeoutMs: 5_000, changed: "notifications/roots/list_changed" } as const;

/** console.dir's output as one line of stderr. */
export const STDOUT_GUARD = { line: (text: string) => `${text}\n` } as const;
