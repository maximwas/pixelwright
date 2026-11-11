/** The texts of the versioned write (T-011, D-41) and of the fields every writer shares (D-35). */
export const WRITES_TEXT = {
  versionField:
    "A name for a version saved in the file's history before writing, for the designer to go back to (not in a dry run, nor when nothing would change). Pass one before a write that changes many layers or tokens.",
  dryRunField: "Check without writing: the answer says what would change. Works with Allow edits off.",
  dryOutput:
    "The answer is a dry run's: one asked for, or the check before a version that found nothing to change, so no version was saved.",
  versionOutput: "The version saved in the file's history before the write; id null when Figma gave none.",
  /** The description of the version a write saves first. */
  before: "Saved by Pixelwright before it changed the file.",
  notSaved: (title: string, why: string) => `The version "${title}" could not be saved, so nothing was written: ${why}`,
} as const;
