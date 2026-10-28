/** The file in the channel's home that holds the peers' token and the paired plugins' keys (S-024). */
export const BRIDGE_FILE = "bridge.json";

/** The peers' token: 32 random bytes, base64url, as 0.7.0 makes it, so a dev and a release file read alike. */
export const BRIDGE_TOKEN_BYTES = 32;

/** The shortest token accepted: 32 bytes are 43 base64url characters; a hand-made file needs at least 32. */
export const BRIDGE_TOKEN_MIN_CHARS = 32;

/** How bridge.json spells its random bytes, as 0.7.0 does: keys in lower-case hex, the token in base64url. */
export const BRIDGE_ENCODING = {
  key: "hex",
  token: "base64url",
} as const;
