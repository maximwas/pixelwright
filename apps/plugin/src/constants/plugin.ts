import { BRIDGE_PATH, BRIDGE_PORT } from "@pixelwright/core";

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

/** How many of the last actions the window shows. */
export const RECENT_ACTIONS = 5;

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
