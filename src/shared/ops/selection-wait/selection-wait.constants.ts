/** selection_wait's rounds (T-031): the server loops them, the plugin waits one at a time. */
export const SELECTION_WAIT = {
  /** One round's longest wait: a bridge request lives 30 s, and the plugin must answer first. */
  roundMs: 25_000,
  /** The shortest round: the last one of a wait whose time is all but gone. */
  shortestRoundMs: 1,
} as const;
