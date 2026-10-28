/** Why the owner could not start. */
export const OWNER_FAILURE = {
  /** The system's code for a port another program holds: the bridge then joins it as a peer (S-030). */
  portTakenCode: "EADDRINUSE",
} as const;
