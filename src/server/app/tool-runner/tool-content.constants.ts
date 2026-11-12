/** The content block types a tool answer carries, as MCP's CallToolResult names them. */
export const TOOL_CONTENT_TYPE = { text: "text", image: "image" } as const;

/** The MIME type of an image block: a render is a PNG. */
export const TOOL_IMAGE = { png: "image/png" } as const;
