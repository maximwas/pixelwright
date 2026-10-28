import { HANDSHAKE_TYPE } from "@/shared/protocol/handshake.constants.ts";

/**
 * Where one socket's handshake stands (A§5.2): hello sent; the server proved the key, or issued one after the user's
 * code (trusted); waiting for the code; the code sent; a session; closed.
 */
export const HANDSHAKE_STATE = {
  hello: "hello",
  trusted: "trusted",
  pairing: "pairing",
  pairSent: "pair_sent",
  session: "session",
  closed: "closed",
} as const;

/**
 * The transition table: the states in which each server frame is taken. Anything else is ignored, because a program on
 * the port that did not earn a step proves nothing (memory 1dae07ed): `paired` only right after the window sent the
 * user's code, `hello_ack` only after the server proved the key or issued one.
 */
export const TAKEN_IN = {
  [HANDSHAKE_TYPE.challenge]: [HANDSHAKE_STATE.hello],
  [HANDSHAKE_TYPE.pairingRequired]: [HANDSHAKE_STATE.hello, HANDSHAKE_STATE.pairing, HANDSHAKE_STATE.pairSent],
  [HANDSHAKE_TYPE.paired]: [HANDSHAKE_STATE.pairSent],
  [HANDSHAKE_TYPE.helloAck]: [HANDSHAKE_STATE.trusted],
} as const;

/** What the window shows of the link. */
export const LINK_STATE = {
  connecting: "connecting",
  pairing: "pairing",
  connected: "connected",
  waiting: "waiting",
  stopped: "stopped",
} as const;

/** Why the window closed a socket itself, 0.7.0's words. */
export const LINK_CLOSE_REASON = {
  serverUnproven: "the server could not prove the key",
} as const;
