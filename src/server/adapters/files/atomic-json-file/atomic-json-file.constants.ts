/** How a JSON file of the home folder is spelled on disk. */
export const ATOMIC_JSON_FILE = {
  encoding: "utf8",
  /** open(2)'s "create, fail if it exists": the temp file is this call's alone. */
  createFlag: "wx",
  temp: (
    path: string,
    unique: string,
  ) => `${path}.${unique}.tmp`,
  /** The JSON with a final line break, as editors leave a file. */
  text: (json: string) => `${json}\n`,
} as const;

/** The log lines of a file that cannot be read or written: they name the file and why, never its content. */
export const ATOMIC_JSON_FILE_LOG = {
  offSchema: "file does not match its schema: read as the default",
  unwritten: "file could not be written",
  unreadable: "file could not be read: read as the default",
  notJson: "not JSON",
  /** The reason of an error without a code. */
  unknownCode: "unknown",
  /** A schema issue: where in the file (a dotted path, or the whole file), then what was expected. */
  pathSeparator: ".",
  top: "(top)",
  issue: (
    path: string,
    message: string,
  ) => `${path}: ${message}`,
} as const;
