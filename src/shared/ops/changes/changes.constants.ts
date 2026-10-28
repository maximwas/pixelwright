/** What happened to a layer, as changes_since tells it. */
export const CHANGE_KIND = { created: "created", deleted: "deleted", changed: "changed" } as const;

/** Whose hand a change is (T-035): the user here, a collaborator in the file, or Pixelwright's own write (D-53). */
export const CHANGE_BY = { user: "user", collaborator: "collaborator", pixelwright: "pixelwright" } as const;
