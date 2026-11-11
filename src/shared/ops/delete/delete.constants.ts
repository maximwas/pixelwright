/** nodes_delete's numbers (T-045): one call's layers, and one id's length. */
export const DELETE = {
  /** The most layers one call deletes, each on its own: 0.7.0's limit, one undo step a person can still review. */
  maxNodes: 500,
  /** The longest layer id: an id inside nested instances grows with its depth. */
  idChars: 200,
} as const;
