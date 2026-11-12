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
  sessionGone: (session: string) => `No connected file has session ${session}: call status for the files.`,
} as const;

/** The roles in status's order (tools.json lists them so). */
export const PLUGIN_LINK_ROLES = [
  PLUGIN_LINK_ROLE.owner,
  PLUGIN_LINK_ROLE.peer,
  PLUGIN_LINK_ROLE.handedOver,
  PLUGIN_LINK_ROLE.unavailable,
  PLUGIN_LINK_ROLE.failed,
  PLUGIN_LINK_ROLE.disabled,
] as const;
