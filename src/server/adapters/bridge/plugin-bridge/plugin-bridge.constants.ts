/** A peer that lost its owner, or could not join, tries again after this times 0.5..1.5, so peers spread out (S-030). */
export const PEER_RETRY_MS = 1_000;

/** The low and the span of the retry's jitter. */
export const RETRY_JITTER = {
  low: 0.5,
  span: 1,
} as const;
