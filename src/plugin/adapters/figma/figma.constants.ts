import { DEV_STATUS } from "@/shared/ops/outline/outline.constants.ts";

/** Figma's Dev Mode statuses as the tools write them (T-034, T-044). */
export const FIGMA_DEV_STATUS = { READY_FOR_DEV: DEV_STATUS.ready, COMPLETED: DEV_STATUS.completed } as const;

/** What execute's figma leaves out (D-11, O-028): approved code must not flip the stored Allow edits or the window. */
export const CODE_FIGMA_HIDDEN = ["clientStorage", "ui"] as const;

/** The node type and text field pw.fonts reads. */
export const CODE_FONTS = {
  text: "TEXT",
  fontName: "fontName",
  key: (font: FontName) => `${font.family}\u0000${font.style}`,
} as const;

/** The Figma events the adapters listen to. */
export const FIGMA_EVENT = { selectionChange: "selectionchange" } as const;

export const CODE_FIGMA_TEXT = { noLayer: (id: string) => `No layer ${id} in this file.` } as const;
