/**
 * How long the window waits before it connects again (P-043): 500 ms doubling to 10 s, each wait between half and one
 * and a half of that, so windows of many files do not knock on a restarted server all at once.
 */
export const RECONNECT = {
  firstMs: 500,
  maxMs: 10_000,
  /** The least share of the wait a jittered wait can be; random() adds up to one more. */
  jitterFloor: 0.5,
} as const;
