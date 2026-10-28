/** The shared log: <home>/logs/pixelwright.log, every server of the channel writes to it (plan 3.2). */
export const LOG_FILE = {
  folder: "logs",
  name: "pixelwright.log",
} as const;

export const SERVER_LOG = {
  ready: "pixelwright ready on stdio",
} as const;
