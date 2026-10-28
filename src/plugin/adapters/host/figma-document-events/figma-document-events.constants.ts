/** The Figma event this adapter listens to. */
export const FIGMA_EVENT = {
  currentPageChange: "currentpagechange",
} as const;

/** The events it emits to its observers. */
export const DOCUMENT_EVENT = {
  info: "info",
} as const;
