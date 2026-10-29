/** The change journal's numbers (T-035, D-53, A§15.9), each with its reason. */
export const JOURNAL = {
  /** The most entries it holds; past it the oldest go, and a cursor from before them is told it missed some. */
  maxEntries: 5_000,
  /** Cursors count microseconds from the plugin's start, so a cursor from an earlier run of the plugin is told apart. */
  cursorPerMs: 1_000,
  /**
   * A layer a write touched is Pixelwright's until Figma first reports it after the write, this long at most: a
   * background tab reports changes about a minute late (FX-010).
   */
  ownEchoMs: 90_000,
  /**
   * execute returns no ids (A§15.9): what Figma reports while its code runs, and this soon after, is its own; a
   * foreground tab reports a change just after the code that made it ends.
   */
  executeEchoMs: 1_000,
  /** One entry per layer and hand. */
  key: (id: string, by: string) => `${id} ${by}`,
} as const;
