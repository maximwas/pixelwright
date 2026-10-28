/** The `file` argument every Figma tool takes (T-001): 0.7.0's bound and words. */
export const FILE_INPUT = {
  /** Far above any file name Figma allows, low enough that no argument floods the log. */
  maxChars: 1_024,
  description: "The file to work on: its session from status or its name. Default: the active file.",
} as const;

/** Why a call has no file to work on (T-001), 0.7.0's words. */
export const TARGET_TEXT = {
  separator: ", ",
  ambiguous: (
    file: string,
    sessions: string,
  ) =>
    `Several connected files are named ${file}: sessions ${sessions}. Pass the session from status as file.`,
  notFound: (
    file: string,
    names: string,
  ) => `No connected file is named ${file}. Connected: ${names}.`,
} as const;
