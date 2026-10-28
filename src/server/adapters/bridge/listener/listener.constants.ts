import { BRIDGE_PATH, PEER_PATH } from "@/shared/protocol/protocol.constants.ts";

/** How often the server pings each plugin window; one that stayed silent since the last ping is cut off (S-007). */
export const HEARTBEAT_MS = 15_000;

/** The ws events the adapter listens to. */
export const WS_EVENT = { message: "message", close: "close", pong: "pong", error: "error" } as const;

export const WS_LOG = {
  error: "plugin socket error",
  silent: "plugin socket cut off: no answer since the last ping",
} as const;

/** The file in the channel's home that holds the peers' token and the paired plugins' keys (S-024). */
export const BRIDGE_FILE = "bridge.json";

/** The peers' token: 32 random bytes, base64url, as 0.7.0 makes it, so a dev and a release file read alike. */
export const BRIDGE_TOKEN_BYTES = 32;

/** The shortest token accepted: 32 bytes are 43 base64url characters; a hand-made file needs at least 32. */
export const BRIDGE_TOKEN_MIN_CHARS = 32;

/** How bridge.json spells its random bytes, as 0.7.0 does: keys in lower-case hex, the token in base64url. */
export const BRIDGE_ENCODING = { key: "hex", token: "base64url" } as const;

/** Who upgrades: the plugin's window, or another Pixelwright server joining the owner. */
export const UPGRADE_ROLE = { plugin: "plugin", peer: "peer" } as const;

/** Which check refused an upgrade: the Host it named, or the Origin it came with. */
export const UPGRADE_REFUSAL = { host: "host", origin: "origin" } as const;

/** Who may upgrade on which path; any other path is 404. */
export const UPGRADE_PATHS = [
  { path: BRIDGE_PATH, role: UPGRADE_ROLE.plugin },
  { path: PEER_PATH, role: UPGRADE_ROLE.peer },
] as const;

/** A request URL's path ends where its query starts; a request names its host as name:port. */
export const UPGRADE_URL = { queryStart: "?", host: (name: string, port: number) => `${name}:${port}` } as const;

/**
 * Figma's plugin iframe sends the literal Origin "null" (seen live, FX-002). Any sandboxed iframe or file: page sends
 * it too, so this check stops ordinary web pages only; pairing is the real lock (S-016).
 */
export const PLUGIN_ORIGINS = ["null"];

/** The hosts a request may name besides the port: a DNS-rebinding page names its own (S-002). */
export const LOOPBACK_HOSTS = ["127.0.0.1", "localhost"];

/** Loopback only, never 0.0.0.0, and not "localhost", which may resolve to ::1 first (S-001). */
export const LISTEN_HOST = "127.0.0.1";

/** How long a closing socket may take before it is cut off: a frozen Figma tab never answers the close (S-013). */
export const CLOSE_GRACE_MS = 1_000;

/** The node:http events the listener uses. */
export const HTTP_EVENT = { upgrade: "upgrade", error: "error", finish: "finish" } as const;

export const LISTENER_TEXT = {
  url: (port: number) => `ws://${LISTEN_HOST}:${port}${BRIDGE_PATH}`,
  contentType: "content-type",
  plainText: "text/plain",
  /** A status code node:http has no words for. */
  unknownStatus: "Error",
  /** A refused upgrade: a plain HTTP error, then the socket closes. */
  refusal: (status: number, body: string) =>
    `HTTP/1.1 ${status} ${body}\r\nConnection: close\r\nContent-Type: text/plain\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  /** The log's reason for a refusal that names no check: the path was not the bridge's. */
  pathReason: "path",
  goingAway: "server shutting down",
  /** shortcut: the peer path has no handshake until item 07, so a peer is closed 1011. */
  noPeerHandshake: "the peer handshake is not built yet",
} as const;

export const LISTENER_LOG = { listening: "bridge listening", refused: "bridge refused an upgrade" } as const;
