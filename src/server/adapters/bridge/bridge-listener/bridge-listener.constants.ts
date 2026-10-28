import { BRIDGE_PATH } from "@/shared/protocol/protocol.constants.ts";

/** Loopback only, never 0.0.0.0, and not "localhost", which may resolve to ::1 first (S-001). */
export const LISTEN_HOST = "127.0.0.1";

/** How long a closing socket may take before it is cut off: a frozen Figma tab never answers the close (S-013). */
export const CLOSE_GRACE_MS = 1_000;

/** The node:http events the listener uses. */
export const HTTP_EVENT = {
  upgrade: "upgrade",
  error: "error",
  finish: "finish",
} as const;

export const LISTENER_TEXT = {
  url: (port: number) => `ws://${LISTEN_HOST}:${port}${BRIDGE_PATH}`,
  contentType: "content-type",
  plainText: "text/plain",
  /** A status code node:http has no words for. */
  unknownStatus: "Error",
  /** A refused upgrade: a plain HTTP error, then the socket closes. */
  refusal: (
    status: number,
    body: string,
  ) =>
    `HTTP/1.1 ${status} ${body}\r\nConnection: close\r\nContent-Type: text/plain\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  /** The log's reason for a refusal that names no check: the path was not the bridge's. */
  pathReason: "path",
  goingAway: "server shutting down",
  /** shortcut: the peer path has no handshake until item 07, so a peer is closed 1011. */
  noPeerHandshake: "the peer handshake is not built yet",
} as const;

export const LISTENER_LOG = {
  listening: "bridge listening",
  refused: "bridge refused an upgrade",
} as const;
