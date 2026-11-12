export const FIT = {
  /** design_read's default budget, as 0.7.0 (T-050): a big section reads whole, a page gets cut. */
  maxChars: 80_000,
  /** Rounds of cutting and measuring again: each round's estimate is checked by a real render. */
  rounds: 8,
  /** What a cut branch still costs: its own opening tag stays, with `$truncated="true"`. */
  stubExtra: ' $truncated="true"/>'.length,
  /** What a list cut short adds: `$children="1234"`. */
  limitExtra: ' $children="00000"'.length,
} as const;
