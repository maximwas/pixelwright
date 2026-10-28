const MS_PER_SECOND = 1000;

export const WATCHDOG_TEXT = {
  timeout: (
    op: string,
    timeoutMs: number,
    write: boolean,
  ) =>
    `${op} did not finish in ${timeoutMs / MS_PER_SECOND} s in the plugin${write ? "; it may still be writing, so check the file before you retry" : ""}`,
} as const;
