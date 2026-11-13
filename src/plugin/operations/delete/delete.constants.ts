/** Why delete leaves a layer (T-045, P-160). */
export const DELETE_TEXT = {
  noLayer: (id: string) => `No layer ${id} in this file.`,
  insideInstance:
    'A layer inside an instance comes from its component and cannot be deleted: hide it with display="none" instead.',
} as const;
