/**
 * The two products one source builds. Until the release item every build is the dev channel, a separate product beside
 * the 0.7.0 that is used every day: its own MCP name, home folder, bridge port and plugin, so neither touches the other.
 */
export const CHANNELS = {
  dev: {
    /** The MCP server name (initialize serverInfo.name): its tools list as mcp__pixelwright-new__*. */
    name: "pixelwright-new",
    /** The folder under the user's home for bridge.json, the plugin, logs and stores. */
    home: ".pixelwright-new",
    /** The bridge port, ws://127.0.0.1:<port>/pixelwright/v1. */
    port: 18_721,
    pluginName: "Pixelwright New",
  },
  release: {
    name: "pixelwright",
    home: ".pixelwright",
    port: 18_720,
    pluginName: "Pixelwright",
  },
} as const;

/** The channel this build is: server, plugin manifest and `pnpm try` all read it. */
export const CHANNEL = CHANNELS.dev;
