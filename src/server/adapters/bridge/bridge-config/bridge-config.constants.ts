/** The peers' token: 32 random bytes, base64url, as 0.7.0 makes it, so a dev and a release file read alike. */
export const BRIDGE_TOKEN_BYTES = 32;

/** The shortest token accepted: 32 bytes are 43 base64url characters; a hand-made file needs at least 32. */
export const BRIDGE_TOKEN_MIN_CHARS = 32;
