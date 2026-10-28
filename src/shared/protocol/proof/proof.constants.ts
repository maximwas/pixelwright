/** Who proves it knows the shared secret: the bridge's server or the plugin (the peer handshake adds owner and peer). */
export const PROOF_ROLE = {
  server: "server",
  plugin: "plugin",
  /** The two servers of the peer handshake (S-031), 0.7.0's roles. */
  owner: "owner",
  peer: "peer",
} as const;

export const PROOF_TEXT = {
  /** What a proof signs: 0.7.0's message, theirs first (D-04). */
  message: (
    role: string,
    theirNonce: string,
    ourNonce: string,
  ) => `pixelwright|${role}|${theirNonce}|${ourNonce}`,
} as const;
