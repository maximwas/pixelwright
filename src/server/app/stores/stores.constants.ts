import { SUPPORT_LINKS } from "@/shared/window/ui-message.constants.ts";

/** npm is asked at most once a day per computer: every session shares the answer in latest.json (S-070). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** support.json in the home (T-006, D-34): the sentence at most once a week per computer, whichever session gives it. */
export const SUPPORT_STORE = { file: "support.json", intervalMs: 7 * 24 * 60 * 60 * 1_000 } as const;

/** The one support sentence the model passes on word for word (T-006). */
export const SUPPORT_TEXT = {
  sentence: () =>
    `Pixelwright is free. If it saves you time, you can support its development: ${SUPPORT_LINKS.map(({ label, url }) => `${label} (${url})`).join(", ")}.`,
} as const;

/** version_save's repeat guard (T-181): a version cannot be deleted, so the same title waits ten minutes. */
export const VERSION_REPEAT = {
  repeatMs: 10 * 60 * 1_000,
  minuteMs: 60 * 1_000,
  /** Titles match trimmed and in any case. */
  key: (file: string, title: string) => `${file}\n${title.trim().toLowerCase()}`,
} as const;

export const STORES_TEXT = {
  repeated: (title: string, minutes: number) =>
    `A version named ${title} was saved here ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago (or may have been: that try timed out): check Version history, or use another title.`,
} as const;

/** The update state's file, in the channel's home. */
export const LATEST_FILE = "latest.json";

/**
 * written-files.json in the channel's home (S-101): the newest 5000 files, enough for every asset of many reads, small
 * enough to read on every call.
 */
export const WRITTEN_STORE = { file: "written-files.json", limit: 5_000, version: 1 } as const;

/** Library catalogues (T-193): one per library file, under its name, in the libraries folder of the channel's home. */
export const LIBRARY_FILES = {
  folder: "libraries",
  extension: ".json",
  file: (slug: string) => `${slug}.json`,
  version: 1,
} as const;
