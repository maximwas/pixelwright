/** Open files the bridge keeps at once: far above real use, low enough that nothing on the port can flood status (S-010). */
export const MAX_SESSIONS = 16;

/** Unpaired windows waiting for a code at once: a page cannot hold more slots than this (S-010). */
export const MAX_WAITING = 8;
