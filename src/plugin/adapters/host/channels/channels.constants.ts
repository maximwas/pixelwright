/** The figma.ui event that carries the window's messages to main. */
export const UI_EVENT = { message: "message" } as const;

/**
 * The window (P-002): 280 px wide, as tall as what it shows (the pairing field, the hint and the activity come and go),
 * from a status line's height to most of a laptop screen's.
 */
export const WINDOW_SIZE = { width: 280, minHeight: 120, maxHeight: 560 } as const;

import { CHANGE_KIND } from "@/shared/ops/changes/changes.constants.ts";

/** The Figma events these adapters listen to. */
export const FIGMA_EVENT = { currentPageChange: "currentpagechange", nodeChange: "nodechange" } as const;

/** A Figma node change as the journal names it, and the origin of another user's change. */
export const FIGMA_CHANGE = {
  kind: { CREATE: CHANGE_KIND.created, DELETE: CHANGE_KIND.deleted, PROPERTY_CHANGE: CHANGE_KIND.changed },
  property: "PROPERTY_CHANGE",
  remote: "REMOTE",
} as const;
