import { BRIDGE_PATH, BRIDGE_PORT, SILENT_OPERATIONS } from "@pixelwright/core";

export const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}${BRIDGE_PATH}`;

/**
 * Small and out of the way: it stays open the whole time the plugin works. Tall enough for the pairing field and the
 * longest stop reason (188 px was not, stage-1 review).
 */
export const PLUGIN_WINDOW = {
  width: 280,
  height: 260,
  title: "Pixelwright",
} as const;

/** figma.clientStorage key of the paired key: per user and plugin, shared by every file, so pairing is once a machine. */
export const PAIRING_STORAGE_KEY = "pixelwright.pairing";

/** figma.clientStorage key of a file where Allow edits is on, followed by the file's id: one key per file. */
export const EDITS_STORAGE_PREFIX = "pixelwright.allowEdits.";

/** Plugin data key on the document of the id Pixelwright gives a file where Figma gives no file key. */
export const FILE_ID_KEY = "fileId";

/** The window follows its content's height (the pairing field and the hint come and go), within these bounds. */
export const WINDOW_HEIGHT = {
  min: 120,
  max: 560,
} as const;

/** How many of the last actions the window shows. */
export const RECENT_ACTIONS = 5;

/** What the window's activity calls each request; a request not here goes by its operation's name. */
export const ACTION_NAMES: Readonly<Record<string, string>> = {
  snapshot: "Read a design",
  outline: "Read the page outline",
  export: "Exported an image",
  image: "Exported an image",
  components: "Read components",
  variables: "Read styles and variables",
  find: "Searched layers",
  selection: "Read the selection",
  show: "Showed layers",
  viewport: "Read the view",
  inspect: "Inspected layers",
  apply: "Changed the file",
  delete: "Deleted layers",
  execute: "Ran code",
  tokens_apply: "Wrote tokens",
};

/** Steps of another action the activity leaves out: status probes, the reads before a write, files on their way in. */
export const QUIET_OPERATIONS: ReadonlySet<string> = new Set([...SILENT_OPERATIONS, "entries", "upload"]);

export const RECONNECT = {
  firstMs: 500,
  maxMs: 10_000,
} as const;

/** The most nodes one outline lists, far below the bridge's message limit; children past it are counted, not listed. */
export const OUTLINE_MAX_NODES = 2_000;

/**
 * The most JSON one snapshot builds before it stops adding layers: a third of the bridge's message limit, as text in
 * other scripts takes up to three bytes a character. design_read shows far less than this anyway.
 */
export const SNAPSHOT_MAX_CHARS = 1_000_000;

/**
 * How long one operation may walk a big file before it answers with what it has (and more: true): under the server's
 * 30 s request timeout, which would lose everything.
 */
export const OP_BUDGET_MS = 20_000;

/** How long tokens reading may spend on the libraries' catalogue: the local tokens must still come back in time. */
export const LIBRARY_BUDGET_MS = 10_000;

/** Main components looked up at once for components_read. */
export const MAIN_COMPONENT_BATCH = 25;

/**
 * How far a font's weight may be from the one asked for and still be taken (CSS takes the nearest; a variable font
 * reports weights like SF Pro Semibold's 590): a style further off is an error naming the family's styles.
 */
export const NEAR_FONT_WEIGHT = 50;

/** How many bytes of files may wait for their apply at once before the oldest go: four of the largest a call sends. */
export const UPLOAD_BYTES = 128 * 1024 * 1024;

/** How long a file sent for an apply waits for it. */
export const UPLOAD_TTL_MS = 5 * 60 * 1000;

/** Room around and between a new component set's variants. */
export const SET_GAP = 40;

/** Pixelwright's mark, as on the website and its tab icon: a blue tile with a white selection frame. */
export const MARK_SVG =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0d99ff"/><rect x="9" y="9" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2"/><g fill="#0d99ff" stroke="#fff" stroke-width="1.8"><rect x="6.2" y="6.2" width="5.6" height="5.6"/><rect x="20.2" y="6.2" width="5.6" height="5.6"/><rect x="6.2" y="20.2" width="5.6" height="5.6"/><rect x="20.2" y="20.2" width="5.6" height="5.6"/></g></svg>';

/** The most layers viewport lists as in view. */
export const VIEWPORT_MAX_LAYERS = 50;
