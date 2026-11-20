/** Open files the bridge keeps at once: far above real use, low enough that nothing on the port can flood status (S-010). */
export const MAX_SESSIONS = 16;

/** Unpaired windows waiting for a code at once: a page cannot hold more slots than this (S-010). */
export const MAX_WAITING = 8;

/**
 * How long a plugin is expected after this server came up on the bridge or its last file left, and so the longest a
 * call waits for one. A plugin that lost its server retries on a wait that doubles from 0.5 s to a 10 s cap with jitter
 * up to 1.5x (RECONNECT, plugin-ui/link/link.constants), so 15 s is its longest gap; 5 s more cover its handshake and
 * the status that follows. A plugin that is open has connected within this long; later, none is coming.
 */
export const PLUGIN_WINDOW_MS = 20_000;

/** The 4409 reason, 0.7.0's words. */
export const SUPERSEDED_REASON = "superseded by a newer connection of the same plugin window";

export const SESSION_LOG = { connected: "plugin connected", disconnected: "plugin disconnected" } as const;
