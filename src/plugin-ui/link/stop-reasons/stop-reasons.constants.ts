import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

/** What the window does after its socket closed: connect again after a wait, or stay closed until it is run again. */
export const CLOSE_ACTION = {
  retry: "retry",
  stop: "stop",
} as const;

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
  {
    code: CLOSE_CODE.versionMismatch,
    olderServer: true,
    action: CLOSE_ACTION.retry,
    text: LINK_TEXT.olderServer,
  },
  {
    code: CLOSE_CODE.versionMismatch,
    olderServer: false,
    action: CLOSE_ACTION.stop,
    text: LINK_TEXT.update,
  },
  {
    code: CLOSE_CODE.superseded,
    olderServer: false,
    action: CLOSE_ACTION.stop,
    text: LINK_TEXT.superseded,
  },
  {
    code: CLOSE_CODE.unauthorized,
    olderServer: false,
    action: CLOSE_ACTION.retry,
    text: LINK_TEXT.unproven,
  },
  {
    code: CLOSE_CODE.tooManySessions,
    olderServer: false,
    action: CLOSE_ACTION.retry,
    text: LINK_TEXT.tooManySessions,
  },
  {
    code: CLOSE_CODE.helloTimeout,
    olderServer: false,
    action: CLOSE_ACTION.retry,
    text: LINK_TEXT.helloTimeout,
  },
] as const;
