import { BRIDGE_PATH, BRIDGE_PORT } from "@pixelwright/core";

export const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}${BRIDGE_PATH}`;

/** figma.clientStorage key of the Allow edits switch (per user, per plugin, kept between runs). */
export const ALLOW_EDITS_KEY = "pixelwright.allowEdits";

/** Small and out of the way: it stays open the whole time the plugin works. */
export const PLUGIN_WINDOW = {
  width: 280,
  height: 188,
  title: "Pixelwright",
} as const;

/** How many of the last actions the window shows. */
export const RECENT_ACTIONS = 5;

export const RECONNECT = {
  firstMs: 500,
  maxMs: 10_000,
} as const;
