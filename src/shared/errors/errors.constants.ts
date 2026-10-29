/** An expected failure's name, and the text the MCP client shows: the code first, so the model can act on it. */
export const PIXELWRIGHT_ERROR = {
  name: "PixelwrightError",
  text: (code: string, message: string) => `${code}: ${message}`,
} as const;

/** A layer id the file does not have (P-072): plugin and server say it alike, with the tools that give ids. */
export const NODE_TEXT = {
  notFound: (id: string) => `No node ${id} in this file: find ids with nodes_find, outline or selection_get.`,
} as const;
