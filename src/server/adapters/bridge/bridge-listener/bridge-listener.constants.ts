/** Loopback only, never 0.0.0.0, and not "localhost", which may resolve to ::1 first (S-001). */
export const LISTEN_HOST = "127.0.0.1";

/** How long a closing socket may take before it is cut off: a frozen Figma tab never answers the close (S-013). */
export const CLOSE_GRACE_MS = 1_000;
