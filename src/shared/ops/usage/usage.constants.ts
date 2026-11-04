import { LIMITS } from "@/shared/limits/limits.constants.ts";

/**
 * The usage op's own budgets (D-48, O-009): at most 500 layers come back, 0.7.0's cap; the scan takes at most the
 * caller's budget, 1 ms to LIMITS.opBudgetMs (under the server's wait), and answers with what it found when it is spent.
 */
export const USAGE = { maxLayers: 500, minBudgetMs: 1, maxBudgetMs: LIMITS.opBudgetMs } as const;

/** Where to look besides a layer or page: every page. */
export const USAGE_WITHIN = { file: "file" } as const;

export const USAGE_FIELD = {
  property: "Where the layer uses it: fill, stroke, effect, text, a text run, or a field.",
} as const;
