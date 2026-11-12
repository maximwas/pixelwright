/** How a read is cut to fit maxChars (T-054): branches emptied, and lists or texts cut to their first N. */
export interface FitPlan {
  readonly cut: Set<string>;
  readonly limits: Map<string, number>;
}
