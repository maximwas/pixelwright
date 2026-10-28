/** Open files the bridge keeps at once: far above real use, low enough that nothing on the port can flood status (S-010). */
export const MAX_SESSIONS = 16;

/** Unpaired windows waiting for a code at once: a page cannot hold more slots than this (S-010). */
export const MAX_WAITING = 8;

/** The 4409 reason, 0.7.0's words. */
export const SUPERSEDED_REASON = "superseded by a newer connection of the same plugin window";

export const SESSION_LOG = { connected: "plugin connected", disconnected: "plugin disconnected" } as const;
