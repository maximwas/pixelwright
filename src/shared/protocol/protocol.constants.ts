/** The bridge protocol this build speaks; a plugin on another one is turned away at hello (D-02, one exact check). */
export const PROTOCOL = 6;

/** Where the plugin's window connects: ws://127.0.0.1:<the channel's port><BRIDGE_PATH> (S-001). */
export const BRIDGE_PATH = "/pixelwright/v1";

/**
 * The plugin window's view of the bridge. localhost, not 127.0.0.1: the manifest's networkAccess names localhost
 * (P-060), and Figma lets the window reach no other origin; the guard admits both host names (S-002).
 */
export const BRIDGE_URL_TEXT = {
  /** What the Figma manifest allows. */
  origin: (port: number) => `ws://localhost:${port}`,
  /** Where the window connects. */
  url: (port: number) => `ws://localhost:${port}${BRIDGE_PATH}`,
} as const;

/** Where another Pixelwright server joins the owner, with no Origin, which no browser page can send (S-002). */
export const PEER_PATH = `${BRIDGE_PATH}/peer`;

/** The pairing code the user types into the plugin window: short to type, one in a million to guess. */
export const PAIRING_CODE_DIGITS = 6;

/** A paired plugin's key, hex: its id is a public label, its secret signs the handshake proofs (S-023). */
export const KEY_ID_BYTES = 8;

export const KEY_SECRET_BYTES = 32;

/** Each side's fresh half of a challenge, hex: never seen before, so a recorded proof is worth nothing (S-023). */
export const NONCE_BYTES = 16;

/** A proof is an HMAC-SHA256, hex: SHA-256 gives 32 bytes. */
export const PROOF_BYTES = 32;

/**
 * The longest strings a plugin's info may carry, far above what Figma produces, so whatever connects to the bridge
 * cannot push megabytes into status (S-010). 0.7.0's bounds, byte for byte.
 */
export const PLUGIN_INFO_CHARS = {
  instanceId: 64,
  pluginVersion: 32,
  editorType: 32,
  fileName: 1_024,
  fileKey: 128,
  pageId: 64,
  pageName: 1_024,
  keyId: 64,
} as const;

/** WebSocket close codes both ends know; a plugin decides from the code whether to reconnect (A§5.2). */
export const CLOSE_CODE = {
  /** The server shuts down: the plugin reconnects to whichever server owns the port next. */
  goingAway: 1001,
  /** Something broke on the server (the new key could not be stored): the plugin reconnects. */
  internalError: 1011,
  /** A frame that is not the handshake message the state expects. */
  badMessage: 4400,
  /** The plugin could not prove its key. */
  unauthorized: 4401,
  /** No hello, no proof or no pairing code in time: the plugin reconnects for a fresh start. */
  helloTimeout: 4408,
  /** Another socket of the same plugin window said hello: the old one goes, and does not reconnect. */
  superseded: 4409,
  /** A newer server took the port over: the plugin reconnects to it. */
  handedOver: 4410,
  /** The other end speaks another protocol: the reason names the one it requires. */
  versionMismatch: 4426,
  /** Too many files connected, or too many windows waiting for a code: the plugin retries with backoff. */
  tooManySessions: 4429,
} as const;
