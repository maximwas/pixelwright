/** The hint after a connection was refused: a plugin set up wrong, or a stranger knocking (S-003). */
export const REJECTION_HINT = {
  text: (
    origin: string | null | undefined,
    reason: string | undefined,
    plugin: string,
  ) =>
    `A connection from origin ${origin ?? "(none)"} was refused (${reason}): if it was not the ${plugin} plugin, ignore it.`,
} as const;
