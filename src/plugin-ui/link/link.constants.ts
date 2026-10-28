import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { HANDSHAKE_TYPE } from "@/shared/protocol/handshake.constants.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

/** A window's random id: 12 bytes, as 0.7.0's; it only has to differ from other windows' (S-011). */
export const INSTANCE_ID_BYTES = 12;

export const WINDOW_LINK_ERROR = {
  noContext: "the link asked for the plugin info before main sent the file's context",
} as const;

/**
 * How long the window waits before it connects again (P-043): 500 ms doubling to 10 s, each wait between half and one
 * and a half of that, so windows of many files do not knock on a restarted server all at once.
 */
export const RECONNECT = {
  firstMs: 500,
  maxMs: 10_000,
  /** The least share of the wait a jittered wait can be; random() adds up to one more. */
  jitterFloor: 0.5,
} as const;

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
export const LINK_CLOSE_REASON = { serverUnproven: "the server could not prove the key" } as const;

/** What the window does after its socket closed: connect again after a wait, or stay closed until it is run again. */
export const CLOSE_ACTION = { retry: "retry", stop: "stop" } as const;

/** Why the window waits or stopped, in words for the user: 0.7.0's, with the channel's port (P-044). */
export const LINK_TEXT = {
  update:
    "This plugin and the Pixelwright server speak different versions. Run npx -y pixelwright@latest in a terminal to update the plugin, restart your MCP client, then run the plugin again.",
  superseded: "Another window of this plugin took over the connection.",
  olderServer: `The Pixelwright server on port ${CHANNEL.port} is older than this plugin, maybe another MCP client's: update it (npx -y pixelwright@latest in a terminal) and restart Pixelwright there (/mcp in Claude Code). This window connects by itself once a current server holds the port.`,
  unproven: `The program on port ${CHANNEL.port} could not prove it is your Pixelwright server.`,
  tooManySessions: "Pixelwright has too many connections waiting to pair, maybe another program's: trying again.",
  helloTimeout: "The wait for the pairing code ran out: reconnecting for a new one.",
} as const;

/**
 * The close table (A§5.2, P-044), tried in order: the first row whose code matches decides. A 4426 whose reason names
 * an older protocol than this plugin's came from an older server, which a current one may replace: the window keeps
 * trying (memory d9640dee). Every code not here (1001, 1011, 4400, 4410, a connection that never opened) is retried
 * with no reason. No row ever touches the stored key: a close proves nothing about it (S-025).
 */
export const CLOSE_RULES = [
  { code: CLOSE_CODE.versionMismatch, olderServer: true, action: CLOSE_ACTION.retry, text: LINK_TEXT.olderServer },
  { code: CLOSE_CODE.versionMismatch, olderServer: false, action: CLOSE_ACTION.stop, text: LINK_TEXT.update },
  { code: CLOSE_CODE.superseded, olderServer: false, action: CLOSE_ACTION.stop, text: LINK_TEXT.superseded },
  { code: CLOSE_CODE.unauthorized, olderServer: false, action: CLOSE_ACTION.retry, text: LINK_TEXT.unproven },
  { code: CLOSE_CODE.tooManySessions, olderServer: false, action: CLOSE_ACTION.retry, text: LINK_TEXT.tooManySessions },
  { code: CLOSE_CODE.helloTimeout, olderServer: false, action: CLOSE_ACTION.retry, text: LINK_TEXT.helloTimeout },
] as const;
