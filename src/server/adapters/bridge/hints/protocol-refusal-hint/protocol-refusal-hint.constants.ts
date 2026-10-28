/** The hint after a plugin of another protocol was turned away (S-003, S-004); `plugin` names it with its version. */
export const PROTOCOL_REFUSAL_HINT = {
  plugin: (
    name: string,
    version: string | null,
  ) =>
    version === null ? `The ${name} plugin` : `The ${name} plugin ${version}`,
  older: (
    plugin: string,
    protocol: number,
    required: number,
  ) =>
    `${plugin} that tried to connect is older than this server (protocol ${protocol}; this server speaks ${required}), so it was turned away: ask the user to install the plugin that comes with this server's version and run it again in Figma.`,
  newer: (
    plugin: string,
    protocol: number,
    required: number,
  ) =>
    `${plugin} that tried to connect is newer than this server (protocol ${protocol}; this server speaks ${required}), so it was turned away: update this Pixelwright server and restart it in this MCP client (/mcp in Claude Code).`,
} as const;
