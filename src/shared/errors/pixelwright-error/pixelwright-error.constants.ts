/** An expected failure's name, and the text the MCP client shows: the code first, so the model can act on it. */
export const PIXELWRIGHT_ERROR = {
  name: "PixelwrightError",
  text: (
    code: string,
    message: string,
  ) => `${code}: ${message}`,
} as const;
