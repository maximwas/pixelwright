/** The field that names a handshake frame's kind. */
export const FRAME_TYPE_FIELD = "type";

/** Every handshake frame's type, as 0.7.0 wrote them on the wire (D-04). */
export const HANDSHAKE_TYPE = {
  /** plugin → server, first: who the plugin is, its key's id and its nonce. */
  hello: "hello",
  /** plugin → server: its proof of the key, over the server's nonce. */
  auth: "auth",
  /** plugin → server: the code the user typed. */
  pair: "pair",
  /** server → plugin: the server's proof of the key, and its nonce. */
  challenge: "challenge",
  /** server → plugin: show the code field. */
  pairingRequired: "pairing_required",
  /** server → plugin: the key issued after the right code. */
  paired: "paired",
  /** server → plugin: the plugin is a session now. */
  helloAck: "hello_ack",
} as const;

/** Why a plugin must pair: locked means too many wrong codes, and pairing is paused for expiresInMs. */
export const PAIRING_REASON = {
  noKey: "no_key",
  unknownKey: "unknown_key",
  wrongCode: "wrong_code",
  expired: "expired",
  locked: "locked",
} as const;

/** The shapes of the handshake's strings. */
export const HANDSHAKE_PATTERN = {
  /** Lower-case hex of so many bytes: nonces, proofs, keys. */
  hex: (bytes: number) => new RegExp(`^[0-9a-f]{${bytes * 2}}$`),
  /** So many decimal digits: the pairing code. */
  digits: (count: number) => new RegExp(`^\\d{${count}}$`),
} as const;
