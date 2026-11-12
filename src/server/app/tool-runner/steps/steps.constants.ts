/** Why an answer is refused before it leaves: the zod issues, pretty-printed. */
export const OUTPUT_CHECK = {
  mismatch: (issues: string) => `the answer does not match its outputSchema: ${issues}`,
} as const;

/** The tool-call log's lines (S-058): the tool's name, and whether the call failed. */
export const CALL_LOG = {
  called: (tool: string) => `tool ${tool}`,
  failed: (tool: string) => `tool ${tool} failed`,
} as const;

/** What a failed call answers when the failure is a bug: its first line only, and where the rest is. */
export const ERROR_TEXT = {
  lineBreak: "\n",
  internal: (tool: string, firstLine: string | undefined) =>
    `Internal error in ${tool}: ${firstLine}; see pixelwright logs`,
  timedOut: (
    code: string,
    tool: string,
    message: string,
  ) => `${code}: ${tool}: ${message}`,
} as const;
