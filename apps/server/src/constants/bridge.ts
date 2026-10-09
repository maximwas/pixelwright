import { BRIDGE_PATH, BRIDGE_PORT } from "@pixelwright/core";
import type { UpgradeRole } from "../types/bridge.ts";

/** The bridge port written to a new bridge.json when PIXELWRIGHT_BRIDGE_PORT is not set. */
export const DEFAULT_BRIDGE_PORT = BRIDGE_PORT;

/**
 * Another pixelwright process joining the owner sends bridge.json's token in this header. Browsers cannot set custom
 * WebSocket headers, so no page can send it.
 */
export const BRIDGE_TOKEN_HEADER = "x-pixelwright-token";

/** How often the server pings each plugin; a socket that missed the previous ping is dropped. */
export const HEARTBEAT_MS = 15_000;

/** How long a plugin has to answer one request. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** How long close() lets clients answer the 1001 goodbye before cutting them off. */
export const CLOSE_GRACE_MS = 1_000;

/**
 * How many plugin sessions (open files) the bridge keeps at once; a hello over it is closed 4429. Far above real use,
 * low enough that nothing connecting to the port can flood status.
 */
export const MAX_PLUGIN_SESSIONS = 16;

/** How long a pairing code stays valid, and how many wrong tries it takes before a new one replaces it. */
export const PAIRING_CODE_TTL_MS = 120_000;

export const PAIRING_ATTEMPTS = 5;

/** How many unpaired plugins may wait for a code at once; one more is closed 4429. */
export const MAX_PENDING_PLUGINS = 8;

/** How long a new socket has to say hello before it is closed. */
export const HELLO_TIMEOUT_MS = 5_000;

/** Where other pixelwright processes (other Claude Code sessions) join the process that owns the bridge port. */
export const PEER_PATH = `${BRIDGE_PATH}/peer`;

/** Bumped on every breaking change of the peer messages; the owner closes a peer of another version (4426). */
export const PEER_PROTOCOL_VERSION = 1;

/** How soon a process without the bridge tries again, to take the port over or to join its owner (jittered). */
export const PEER_RETRY_MS = 1_000;

/**
 * How long joining the bridge's owner may take, from the connect to its first answer. A process that holds the port but
 * never answers (stopped, or not pixelwright) must not stall this server's start: the join then counts as failed.
 */
export const PEER_JOIN_TIMEOUT_MS = 3_000;

/** A peer waits this much longer than the owner waits for the plugin, so the owner's TIMEOUT arrives first. */
export const PEER_TIMEOUT_MARGIN_MS = 5_000;

/**
 * Origins the plugin's UI iframe may connect from. Figma's plugin iframe is expected to send "null" (checked live in
 * the stage-1 live check); PIXELWRIGHT_PLUGIN_ORIGINS adds more.
 */
export const DEFAULT_PLUGIN_ORIGINS: readonly string[] = ["null"];

/** Who may upgrade on which path. */
export const UPGRADE_ROLES: Readonly<Record<string, UpgradeRole>> = {
  [BRIDGE_PATH]: "plugin",
  [PEER_PATH]: "peer",
};
