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
    /**
     * The Figma plugin id: a manifest-imported development plugin may take any string (P1), and clientStorage is kept
     * per id, so this plugin's pairing key and Allow edits never mix with 0.7.0's.
     */
    pluginId: "pixelwright-new",
  },
  release: {
    name: "pixelwright",
    home: ".pixelwright",
    port: 18_720,
    pluginName: "Pixelwright",
    /** The id Figma gave the published plugin: every user's install and clientStorage hang on it (P-060). */
    pluginId: "1691873879456586177",
  },
} as const;

/** The channel this build is: server, plugin manifest and `pnpm try` all read it. */
export const CHANNEL: Channel = CHANNELS.dev;

/** One channel's values; the manifest is written for either. */
export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];
