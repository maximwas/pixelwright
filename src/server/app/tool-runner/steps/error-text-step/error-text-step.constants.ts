/** What a failed call answers when the failure is a bug: its first line only, and where the rest is. */
export const ERROR_TEXT = {
  lineBreak: "\n",
  internal: (
    tool: string,
    firstLine: string | undefined,
  ) =>
    `Internal error in ${tool}: ${firstLine}; see pixelwright logs`,
} as const;
