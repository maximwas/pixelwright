/**
 * The roles a server can have on the bridge: it owns the port, joins the owner as a peer, handed it over to a newer
 * server, cannot reach it yet, failed to set it up, or runs with the bridge off (PIXELWRIGHT_PLUGIN_BRIDGE=off).
 */
export const PLUGIN_LINK_ROLES = ["owner", "peer", "handedOver", "unavailable", "failed", "disabled"] as const;
