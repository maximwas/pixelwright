/** The field that tells a result from a failure. */
export const OP_RESULT_FIELD = "ok";

/** Why part of a read is not in its answer (D-05): a budget, children not read, a page Figma would not load, time. */
export const CUT_REASON = {
  budget: "budget",
  children: "children",
  page: "page",
  time: "time",
} as const;
