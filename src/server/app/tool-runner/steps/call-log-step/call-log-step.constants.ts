/** The tool-call log's lines (S-058): the tool's name, and whether the call failed. */
export const CALL_LOG = {
  called: (tool: string) => `tool ${tool}`,
  failed: (tool: string) => `tool ${tool} failed`,
} as const;
