import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/**
 * The roles a server can have on the bridge: it owns the port, joins the owner as a peer, handed it over to a newer
 * server, cannot reach it yet, failed to set it up, or runs with the bridge off (PIXELWRIGHT_PLUGIN_BRIDGE=off).
 */
export const PLUGIN_LINK_ROLE = {
  owner: "owner",
  peer: "peer",
  handedOver: "handedOver",
  unavailable: "unavailable",
  failed: "failed",
  disabled: "disabled",
} as const;

/** Why a call cannot reach a plugin (T-001, S-042), 0.7.0's words: the target resolver and every link say them. */
export const LINK_TEXT = {
  notConnected: `No Figma file is connected: run the ${CHANNEL.pluginName} plugin in Figma Desktop and keep its window open.`,
  pluginLeft: `The ${CHANNEL.pluginName} plugin left a moment ago and has not come back yet: it reconnects by itself, so call again in a few seconds. If its window was closed, run the plugin in Figma Desktop again.`,
  sessionGone: (session: string) => `No connected file has session ${session}: call status for the files.`,
} as const;

/**
 * How a call's wait for a plugin ended: a file connected; no plugin was expected, or none came; or none came though a
 * file was connected a moment before.
 */
export const PLUGIN_ARRIVAL = { arrived: "arrived", absent: "absent", left: "left" } as const;

/** The roles in status's order (tools.json lists them so). */
export const PLUGIN_LINK_ROLES = [
  PLUGIN_LINK_ROLE.owner,
  PLUGIN_LINK_ROLE.peer,
  PLUGIN_LINK_ROLE.handedOver,
  PLUGIN_LINK_ROLE.unavailable,
  PLUGIN_LINK_ROLE.failed,
  PLUGIN_LINK_ROLE.disabled,
] as const;
