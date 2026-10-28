import { BRIDGE_PATH, PEER_PATH } from "../../../../shared/protocol/protocol.constants.ts";
import type { UpgradeRole } from "./upgrade-guard.types.ts";

/** Who may upgrade on which path; any other path is 404. */
export const UPGRADE_PATHS: readonly { readonly path: string; readonly role: UpgradeRole }[] = [
  {
    path: BRIDGE_PATH,
    role: "plugin",
  },
  {
    path: PEER_PATH,
    role: "peer",
  },
];

/**
 * Figma's plugin iframe sends the literal Origin "null" (seen live, FX-002). Any sandboxed iframe or file: page sends
 * it too, so this check stops ordinary web pages only; pairing is the real lock (S-016).
 */
export const PLUGIN_ORIGINS = ["null"];

/** The hosts a request may name besides the port: a DNS-rebinding page names its own (S-002). */
export const LOOPBACK_HOSTS = ["127.0.0.1", "localhost"];
