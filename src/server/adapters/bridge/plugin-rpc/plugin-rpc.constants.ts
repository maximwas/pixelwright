const MS_PER_SECOND = 1000;

/**
 * The plugin's watchdog answers TIMEOUT at the op's timeout, knowing whether a write may still run; the server waits
 * this much longer, so that answer arrives first.
 */
export const SERVER_GRACE_MS = 1_000;

export const PLUGIN_RPC_TEXT = {
  timeout: (
    op: string,
    timeoutMs: number,
  ) =>
    `${op}: the plugin did not answer in ${timeoutMs / MS_PER_SECOND} s; bring its file to the front in Figma (a background tab is slowed) and try again`,
  disconnected: "The plugin window closed or lost its connection before it answered: reopen it and try again.",
} as const;
