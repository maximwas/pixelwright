import { HANDSHAKE_TYPE, PAIRING_REASON } from "../../../../shared/protocol/handshake.constants.ts";
import type { PairingReason } from "../../../../shared/protocol/handshake.schema.ts";
import { CLOSE_CODE } from "../../../../shared/protocol/protocol.constants.ts";
import { CODE_CHECK } from "../pairing-codes/pairing-codes.constants.ts";
import type { CodeOutcome } from "../pairing-codes/pairing-codes.types.ts";

/** How long a new socket has to say hello, and a challenged one to prove its key: a page cannot sit on a socket (S-008). */
export const HELLO_TIMEOUT_MS = 5_000;

/** The states of one plugin socket: waiting for hello, for the proof, for the code, a session, closed. */
export const CONNECTION_STATE = {
  hello: "hello",
  challenged: "challenged",
  pairing: "pairing",
  session: "session",
  closed: "closed",
} as const;

/** Why the server closed a plugin socket, 0.7.0's words byte for byte: the plugin may show or parse them. */
export const CLOSE_REASON = {
  invalidMessage: "invalid message",
  expectedHello: "expected hello",
  unproven: "the plugin could not prove its key",
  expectedCode: "expected the pairing code",
  helloTimeout: "hello timeout",
  authTimeout: "auth timeout",
  codeTimeout: "waited too long for the pairing code",
  tooManyWaiting: "too many plugins waiting to be paired",
  tooManySessions: "too many plugin sessions",
  keyNotStored: "the key could not be stored",
} as const;

/**
 * The transition table of the handshake (A§5.2): the one frame each waiting state takes, and how a frame of another
 * type is turned away. hello → challenged (a known key) or pairing (none) → session; any state → closed.
 */
export const EXPECTED_FRAMES = {
  [CONNECTION_STATE.hello]: {
    type: HANDSHAKE_TYPE.hello,
    code: CLOSE_CODE.badMessage,
    reason: CLOSE_REASON.expectedHello,
  },
  [CONNECTION_STATE.challenged]: {
    type: HANDSHAKE_TYPE.auth,
    code: CLOSE_CODE.unauthorized,
    reason: CLOSE_REASON.unproven,
  },
  [CONNECTION_STATE.pairing]: {
    type: HANDSHAKE_TYPE.pair,
    code: CLOSE_CODE.badMessage,
    reason: CLOSE_REASON.expectedCode,
  },
} as const;

/** The pairing_required reason for a typed code that did not pair (S-022). */
export const NOT_PAIRED_REASONS = {
  [CODE_CHECK.wrong]: PAIRING_REASON.wrongCode,
  [CODE_CHECK.expired]: PAIRING_REASON.expired,
  [CODE_CHECK.locked]: PAIRING_REASON.locked,
} as const satisfies Record<Exclude<CodeOutcome, typeof CODE_CHECK.ok>, PairingReason>;

export const CONNECTION_LOG = {
  closed: "plugin connection closed by the server",
  otherProtocol: "plugin of another protocol turned away",
  keyNotStored: "the paired plugin's key could not be stored",
} as const;
