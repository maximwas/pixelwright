/** MCP annotations by kind (S-053): a read changes nothing in Figma; a write makes clients ask before each call. */
export const TOOL_ANNOTATIONS = {
  read: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  write: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const;
