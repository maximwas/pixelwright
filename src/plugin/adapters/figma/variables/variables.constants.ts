/** The enabled libraries' variables tokens_read lists by name (T-160): 500 at most, 0.7.0's cap, the rest counted. */
export const LIBRARY_LIST = { maxVariables: 500 } as const;

/** The style fields a layer names a style in, and how tokens_usage says a layer uses a style through each (T-106). */
export const STYLE_USES = [
  ["fillStyleId", "fill"],
  ["strokeStyleId", "stroke"],
  ["effectStyleId", "effect"],
  ["textStyleId", "text"],
] as const;

/** The fields of a text's runs that hold a style or a variable (O-024), and how tokens_usage says a run uses one. */
export const TEXT_RUN = {
  fields: ["fillStyleId", "textStyleId", "fills", "boundVariables"],
  use: "a text run",
} as const;

export const VARIABLES_TEXT = {
  slow: (read: number, total: number) => `The libraries took too long: read ${read} of ${total} collections.`,
  failed: (error: string) => `The libraries could not be read: ${error}`,
  more: (hidden: number) =>
    `${hidden} more library variables are not listed: tokens_read in the library's own file reads them all, with their values.`,
} as const;
