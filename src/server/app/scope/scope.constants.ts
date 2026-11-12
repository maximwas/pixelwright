/** The `within` that names every page of the file (T-041). */
export const WITHIN = { file: "file" } as const;

/** Roots a within list takes: one find each, so the same 50 as assets_export's nodes. */
export const WITHIN_LIMIT = { maxRoots: 50 } as const;

/** What a tool whose layer defaults to the selection says when not one layer is selected (T-051, D-64). */
export const SELECTED_TEXT = {
  none: "Nothing is selected in Figma: select one layer, or pass node (outline and nodes_find give ids).",
  several: (count: number) => `${count} layers are selected: select one, or pass node.`,
} as const;
