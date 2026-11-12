/** The nearby op's bounds both sides read (T-058, K-062), as 0.7.0 took them. */
export const NEARBY = {
  /** How far around a screen notes are looked for, at most, in px. */
  maxDistance: 5_000,
  /** Notes one read lists, nearest first. */
  maxNotes: 20,
} as const;

/** Where a note sits from the screen: over it when their boxes overlap, else the side of the larger gap. */
export const NOTE_SIDE = { over: "over", left: "left", right: "right", above: "above", below: "below" } as const;

export const NEARBY_FIELD = {
  text: "Its texts, top to bottom.",
  side: "Where it sits from the screen; over it when their boxes overlap.",
  distance: "The gap between its box and the screen's, in px.",
} as const;
