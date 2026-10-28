/** The peer handshake's three frames (S-031): they never change in any version, so an owner hands over only after them. */
export const PEER_HANDSHAKE_TYPE = {
  peerHello: "peer_hello",
  peerChallenge: "peer_challenge",
  peerAuth: "peer_auth",
} as const;

/** The peer protocol: 0.7.0 spoke 2; 0.8.0's owner contract (oRPC) is 3. An older peer is closed 4426 (S-034). */
export const PEER_PROTOCOL = 3;

/** A peer joins within this, or the port's holder is not a Pixelwright that answers: server start never stalls (S-031). */
export const PEER_JOIN_TIMEOUT_MS = 3_000;

/** Close reasons of the peer socket, 0.7.0's words. */
export const PEER_REASON = {
  protocolRequired: (protocol: number) => `peer protocol ${protocol} required`,
  handedOver: "handed over to a newer Pixelwright server",
  badMessage: "not a peer handshake frame",
  badProof: "the token proof did not match",
  joinTimeout: "the peer did not join in time",
} as const;
