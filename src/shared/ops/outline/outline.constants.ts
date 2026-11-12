/** outline's bounds both sides read (T-044), as 0.7.0 took them. */
export const OUTLINE = {
  /** Three levels find the sections of a page or a big frame without listing every layer. */
  defaultDepth: 3,
  minDepth: 1,
  /** Ten levels at most: past them, outline the deeper layer on its own. */
  maxDepth: 10,
} as const;

/** A layer's Dev Mode status as the tools write it: ready for development, or completed. */
export const DEV_STATUS = { ready: "ready", completed: "completed" } as const;
