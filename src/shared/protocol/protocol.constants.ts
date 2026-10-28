/** The bridge protocol this build speaks; a plugin on another one is turned away at hello (D-02, one exact check). */
export const PROTOCOL = 6;

/** Where the plugin's window connects: ws://127.0.0.1:<the channel's port><BRIDGE_PATH> (S-001). */
export const BRIDGE_PATH = "/pixelwright/v1";

/** Where another Pixelwright server joins the owner, with no Origin, which no browser page can send (S-002). */
export const PEER_PATH = `${BRIDGE_PATH}/peer`;

/** The pairing code the user types into the plugin window: short to type, one in a million to guess. */
export const PAIRING_CODE_DIGITS = 6;

/** A paired plugin's key, hex: its id is a public label, its secret signs the handshake proofs (S-023). */
export const KEY_ID_BYTES = 8;

export const KEY_SECRET_BYTES = 32;

/** WebSocket close codes both ends know; a plugin decides from the code whether to reconnect (A§5.2). */
export const CLOSE_CODE = {
  /** The server shuts down: the plugin reconnects to whichever server owns the port next. */
  goingAway: 1001,
  /** Something broke on the server: the plugin reconnects. */
  internalError: 1011,
  /** A newer server took the port over: the plugin reconnects to it. */
  handedOver: 4410,
  /** The other end speaks another protocol: the reason names the one it requires. */
  versionMismatch: 4426,
} as const;
