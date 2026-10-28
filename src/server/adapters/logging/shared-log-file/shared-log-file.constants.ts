/** The shared log is set aside as `.1` by the first write that finds it past this: big enough for a day of calls. */
export const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** How the shared log is spelled on disk: opened for appending, set aside beside itself. */
export const SHARED_LOG_FILE = {
  appendFlag: "a",
  setAside: (path: string) => `${path}.1`,
} as const;
