import { BRIDGE_PATH, PEER_PATH } from "@/shared/protocol/protocol.constants.ts";

/** Who upgrades: the plugin's window, or another Pixelwright server joining the owner. */
export const UPGRADE_ROLE = {
  plugin: "plugin",
  peer: "peer",
} as const;

/** Which check refused an upgrade: the Host it named, or the Origin it came with. */
export const UPGRADE_REFUSAL = {
  host: "host",
  origin: "origin",
} as const;

/** Who may upgrade on which path; any other path is 404. */
export const UPGRADE_PATHS = [
  {
    path: BRIDGE_PATH,
    role: UPGRADE_ROLE.plugin,
  },
  {
    path: PEER_PATH,
    role: UPGRADE_ROLE.peer,
  },
] as const;

/** A request URL's path ends where its query starts; a request names its host as name:port. */
export const UPGRADE_URL = {
  queryStart: "?",
  host: (
    name: string,
    port: number,
  ) => `${name}:${port}`,
} as const;

/**
 * Figma's plugin iframe sends the literal Origin "null" (seen live, FX-002). Any sandboxed iframe or file: page sends
 * it too, so this check stops ordinary web pages only; pairing is the real lock (S-016).
 */
export const PLUGIN_ORIGINS = ["null"];

/** The hosts a request may name besides the port: a DNS-rebinding page names its own (S-002). */
export const LOOPBACK_HOSTS = ["127.0.0.1", "localhost"];
