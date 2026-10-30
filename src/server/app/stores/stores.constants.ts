/** npm is asked at most once a day per computer: every session shares the answer in latest.json (S-070). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** The update state's file, in the channel's home. */
export const LATEST_FILE = "latest.json";
