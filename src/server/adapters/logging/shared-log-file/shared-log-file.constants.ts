/** The shared log is set aside as `.1` by the first write that finds it past this: big enough for a day of calls. */
export const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024;
