/** npm is asked at most once a day per computer: every session shares the answer in latest.json (S-070). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** The update state's file, in the channel's home. */
export const LATEST_FILE = "latest.json";

/**
 * written-files.json in the channel's home (S-101): the newest 5000 files, enough for every asset of many reads, small
 * enough to read on every call.
 */
export const WRITTEN_STORE = { file: "written-files.json", limit: 5_000, version: 1 } as const;
