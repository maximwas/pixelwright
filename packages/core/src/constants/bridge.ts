/**
 * Bumped on every breaking change of the bridge messages; the server closes a plugin of another version (4426).
 * 2 (09.10.2026): pairing and challenge-response; open error codes.
 */
export const BRIDGE_PROTOCOL_VERSION = 2;

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
  InternalError: 1011,
  BadMessage: 4400,
  Unauthorized: 4401,
  HelloTimeout: 4408,
  Superseded: 4409,
  VersionMismatch: 4426,
  TooManySessions: 4429,
} as const;

/** The plugin must NOT reconnect after these: another window of it took over, or a version needs an update. */
export const NO_RECONNECT_CODES: ReadonlySet<number> = new Set([CloseCode.Superseded, CloseCode.VersionMismatch]);

/** The event the plugin sends whenever its file, page, window visibility or Allow edits changes. */
export const PLUGIN_INFO_EVENT = "plugin.info";

/** Operations the plugin window does not list among the last actions: probes, not something the model asked for. */
export const SILENT_OPERATIONS: ReadonlySet<string> = new Set(["ping"]);

/** Digits of the pairing code the server shows and the user types into the plugin window. */
export const PAIRING_CODE_LENGTH = 6;
