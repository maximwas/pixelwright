/** The enabled libraries' variables tokens_read lists by name (T-160): 500 at most, 0.7.0's cap, the rest counted. */
export const LIBRARY_LIST = { maxVariables: 500 } as const;

export const VARIABLES_TEXT = {
  slow: (read: number, total: number) => `The libraries took too long: read ${read} of ${total} collections.`,
  failed: (error: string) => `The libraries could not be read: ${error}`,
  more: (hidden: number) =>
    `${hidden} more library variables are not listed: read a smaller set by naming collections in the library itself.`,
} as const;
