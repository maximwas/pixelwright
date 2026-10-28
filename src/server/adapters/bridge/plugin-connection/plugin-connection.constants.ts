import { CLOSE_CODE } from "../../../../shared/protocol/protocol.constants.ts";

/** How long a new socket has to say hello, and a challenged one to prove its key: a page cannot sit on a socket (S-008). */
export const HELLO_TIMEOUT_MS = 5_000;

/**
 * The transition table of the handshake (A§5.2): the one frame each waiting state takes, and how a frame of another
 * type is turned away. hello → challenged (a known key) or pairing (none) → session; any state → closed. Texts are
 * 0.7.0's, byte for byte.
 */
export const EXPECTED_FRAMES = {
  hello: {
    type: "hello",
    code: CLOSE_CODE.badMessage,
    reason: "expected hello",
  },
  challenged: {
    type: "auth",
    code: CLOSE_CODE.unauthorized,
    reason: "the plugin could not prove its key",
  },
  pairing: {
    type: "pair",
    code: CLOSE_CODE.badMessage,
    reason: "expected the pairing code",
  },
} as const;

/** The pairing_required reason for a typed code that did not pair (S-022). */
export const NOT_PAIRED_REASONS = {
  wrong: "wrong_code",
  expired: "expired",
  locked: "locked",
} as const;
