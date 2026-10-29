/** The read model's header (A§7.1, D-05): its version, exact like the protocol's, and the numbers its fields keep. */
export const READ_MODEL = {
  version: 1,
  /** A mirrored layer's relative transform keeps its 2x2 part: a, b, c, d. */
  matrixEntries: 4,
  /** A style's number among those of its kind with its name: the first keeps the bare name, the next is --Name-2. */
  firstDuplicate: 2,
} as const;

/**
 * Who a read is for (A§7.1.2): each profile reads its own field groups. A baseline v1 snapshot, which has no header, is
 * a design read.
 */
export const READ_PROFILE = { design: "design", apply: "apply", inspect: "inspect", checks: "checks" } as const;

/** Values the plugin sends in place of Figma's own. */
export const READ_VALUE = {
  /** Figma's `figma.mixed`: a property that differs across a node's parts. */
  mixed: "mixed",
  /** A text decoration drawn in the text's own colour. */
  autoColor: "AUTO",
} as const;
