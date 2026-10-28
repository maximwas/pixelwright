const MS_PER_SECOND = 1000;

/** A timed-out op in words (A§6.5); the error text step puts the tool's name before it. */
export const OP_TIMEOUT_TEXT = {
  write: "the plugin may still be writing: read the layers before you retry",
  read: (timeoutMs: number) =>
    `the plugin did not answer in ${timeoutMs / MS_PER_SECOND} s; bring its file to the front in Figma (a background tab is slowed) and try again`,
} as const;
