/** Bumped on every breaking change of the bridge messages; the server closes a plugin of another version (4426). */
export const BRIDGE_PROTOCOL_VERSION = 1;

export const BRIDGE_PATH = "/pixelwright/v1";

/** The bridge port, also in the plugin's manifest: not figma-console's 9223–9232, not Sitewright's 18710. */
export const BRIDGE_PORT = 18_720;

/**
 * Server maxPayload; the plugin refuses to send more. A stdio MCP message breaks above 10 MiB, and a tool result
 * travels twice in it (text content and structuredContent).
 */
export const MAX_MESSAGE_BYTES = 4 * 1024 * 1024;

/** WebSocket close codes of the bridge; 4xxx are its own. */
export const CloseCode = {
  GoingAway: 1001,
  BadMessage: 4400,
  HelloTimeout: 4408,
  Superseded: 4409,
  VersionMismatch: 4426,
  TooManySessions: 4429,
} as const;

/** The plugin must NOT reconnect after these: another window of it took over, or a version needs an update. */
export const NO_RECONNECT_CODES: ReadonlySet<number> = new Set([CloseCode.Superseded, CloseCode.VersionMismatch]);

/** The event the plugin sends whenever its file, page, window visibility or Allow edits changes. */
export const PLUGIN_INFO_EVENT = "plugin.info";
