/** npm is asked at most once a day per computer: every session shares the answer in latest.json (S-070). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** The update state's file, in the channel's home. */
export const LATEST_FILE = "latest.json";

/**
 * written-files.json in the channel's home (S-101): the newest 5000 files, enough for every asset of many reads, small
 * enough to read on every call.
 */
export const WRITTEN_STORE = { file: "written-files.json", limit: 5_000, version: 1 } as const;

/**
 * Baselines (T-200, K-058, D-33): format 1 files, one per name, in the project's .pixelwright/baselines; compact JSON
 * with a final newline. A newer format is refused, not misread.
 */
export const BASELINE_FILES = {
  folder: ".pixelwright/baselines",
  file: (name: string) => `${name}.json`,
  extension: ".json",
  format: 1,
  /** A baseline's name: lowercase words joined by hyphens, as code names files (pricing, plan-card); no path is one. */
  name: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /** A name a tool takes: 1 to 64 characters. */
  minName: 1,
  maxName: 64,
  encoding: "utf8",
  missing: "ENOENT",
  text: (json: string) => `${json}\n`,
} as const;

/** What the baseline store says when a project or a file cannot hold a baseline. */
export const BASELINE_TEXT = {
  noProject: (folder: string) =>
    `${folder} is no project folder, so baselines have nowhere to live: start the MCP client in the project, or set CLAUDE_PROJECT_DIR.`,
  unreadable: (path: string, why: string) => `${path} cannot be read: ${why}`,
  newer: "saved by a newer Pixelwright: update it",
  offFormat: (at: string, message: string) => `${at || "the file"}: ${message}`,
  pathSeparator: ".",
  notName: (name: string) => `${JSON.stringify(name)} is not a baseline name (pricing, plan-card).`,
  /** An ISO time as the answers write it, its date and its hours and minutes: 2026-11-04 09:12 UTC. */
  utc: (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`,
  tokensUnread: (why: string) =>
    `The tokens could not be read (${why}): a diff compares them as the reads wrote them, one mode.`,
} as const;

/** The designs one-baseline diffs compared, kept for accept (T-202, D-39): the last 8, each under 8 random bytes in hex. */
export const SEEN_DESIGN_IDS = { kept: 8, bytes: 8, encoding: "hex" } as const;

/** Library catalogues (T-193): one per library file, under its name, in the libraries folder of the channel's home. */
export const LIBRARY_FILES = {
  folder: "libraries",
  extension: ".json",
  file: (slug: string) => `${slug}.json`,
  version: 1,
} as const;
