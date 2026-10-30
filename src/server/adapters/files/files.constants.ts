/** How a JSON file of the home folder is spelled on disk. */
export const ATOMIC_JSON_FILE = {
  encoding: "utf8",
  /** open(2)'s "create, fail if it exists": the temp file is this call's alone. */
  createFlag: "wx",
  temp: (path: string, unique: string) => `${path}.${unique}.tmp`,
  /** The JSON with a final line break, as editors leave a file. */
  text: (json: string) => `${json}\n`,
} as const;

/** Where a screenshot may be saved (T-072): a .png path. */
export const PNG_FILE = { extension: ".png" } as const;

/** The largest PNG read to compare with (T-089): a full-page screenshot at 2x fits. */
export const PNG_READ = { megabytes: 50, maxBytes: 50 * 1024 * 1024 } as const;

/**
 * 0.7.0's words for a save path refused, as a read-only tool never writes over a file the user keeps (D-14), and for
 * a PNG to compare with refused (T-089).
 */
export const PNG_FILE_TEXT = {
  notPngPath: (path: string) => `save must be a .png path, not ${path}.`,
  notPngFile: (path: string) => `${path} exists and is not a PNG: choose another path, it is not overwritten.`,
  missing: (path: string) => `There is no file at ${path}.`,
  tooLarge: (path: string) => `${path} is over ${PNG_READ.megabytes} MB.`,
  notPng: (path: string) => `${path} is not a PNG: save the screenshot to compare as PNG.`,
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
  issue: (path: string, message: string) => `${path}: ${message}`,
} as const;
