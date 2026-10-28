/** Why the owner could not start, in words for the hint. */
export const OWNER_FAILURE = {
  /** The system's code for a port another program holds. */
  portTakenCode: "EADDRINUSE",
  /** Item 07 joins such an owner as a peer; until then the owner says who may hold the port. */
  portTaken: (port: number) => `port ${port} is taken by another program or another Pixelwright server.`,
} as const;
