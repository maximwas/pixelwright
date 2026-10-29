import { DEV_STATUS } from "@/shared/ops/outline/outline.constants.ts";

/** The node types the outline treats apart (T-044). */
export const OUTLINE_NODE_TYPE = {
  document: "DOCUMENT",
  page: "PAGE",
  instance: "INSTANCE",
  componentSet: "COMPONENT_SET",
} as const;

/** Figma's Dev Mode statuses as the outline writes them. */
export const FIGMA_DEV_STATUS = { READY_FOR_DEV: DEV_STATUS.ready, COMPLETED: DEV_STATUS.completed } as const;
