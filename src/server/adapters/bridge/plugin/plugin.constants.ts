import type { CodeOutcome } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { HANDSHAKE_TYPE, PAIRING_REASON } from "@/shared/protocol/handshake.constants.ts";
import type { PairingReason } from "@/shared/protocol/handshake.schema.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

const MS_PER_SECOND = 1000;

/**
 * The plugin's watchdog answers TIMEOUT at the op's timeout, knowing whether a write may still run; the server waits
 * this much longer, so that answer arrives first.
 */
export const SERVER_GRACE_MS = 1_000;

export const PLUGIN_RPC_TEXT = {
  timeout: (op: string, timeoutMs: number) =>
    `${op}: the plugin did not answer in ${timeoutMs / MS_PER_SECOND} s; bring its file to the front in Figma (a background tab is slowed) and try again`,
  disconnected: "The plugin window closed or lost its connection before it answered: reopen it and try again.",
} as const;

/** How long a code is good for: time to read it out and type it, too short to guess through (S-020). */
export const PAIRING_CODE_TTL_MS = 120_000;

/** Wrong tries one code allows, from every waiting window together, before pairing pauses (S-020). */
export const PAIRING_ATTEMPTS = 5;

/** The first pause after a code's tries run out; each further spent code doubles it (S-021, D-09). */
export const PAIRING_LOCK_MS = 30_000;

/** The longest pause: a guesser gets a handful of tries an hour, the user waits at most this long. */
export const PAIRING_MAX_LOCK_MS = 3_600_000;

/** What a typed code earned. */
export const CODE_CHECK = {
  /** The right code: a pairing. */
  ok: "ok",
  /** A wrong one: a try spent. */
  wrong: "wrong",
  /** No code in force: none minted yet, or it expired. */
  expired: "expired",
  /** Pairing is paused. */
  locked: "locked",
} as const;

/** A code shorter than its digits is padded with this in front. */
export const PAIRING_CODE_PAD = "0";

export const PAIRING_LOG = {
  minted: "pairing code minted",
  locked: "pairing locked: a code's tries are spent",
} as const;

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
