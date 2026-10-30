/** design_lint as clients list it (tools.json pins every word). */
export const DESIGN_LINT_TOOL = {
  name: "design_lint",
  title: "Lint a design against the general rules",
  description:
    "Checks layers or a page against the rules a design should keep before it is built: texts and runs with no text style, shadows and blurs held by no effect style, gaps, padding, radii, border widths and opacity a variable holds used raw, gaps, padding and radii off the 4 px grid (pills exempt), frames placing children by hand that Figma reads as a row or a column, layers reaching past their parent's flow, grid cell or clip (a text past its column). Each finding names its layer, why, and how to fix it with which tool. Errors first. A layer that could not be read is never reported clean: the summary opens with Not checked and the notes say why. A big board linted whole is slow and its read stops at a size budget (the notes name what was left out): give within its frames' ids instead, a list linted frame by frame in one call. Works while Allow edits is off.",
} as const;

/** The most layers one lint reads, each on its own (0.7.0's LINT_MAX_ROOTS); the findings listed by default and at most. */
export const DESIGN_LINT_LIMITS = { roots: 30, findings: 100, maxFindings: 500 } as const;

export const DESIGN_LINT_FIELD = {
  within: `What to lint: up to ${DESIGN_LINT_LIMITS.roots} layer ids, each read on its own (a big board's frames), or a page id (its top layers). Default: the current page.`,
  rules: "Only these rules. Default: every rule.",
  limit: "The most findings listed; every rule is still counted.",
} as const;

/** What design_lint says of what it read. */
export const DESIGN_LINT_TEXT = {
  page: (name: string) => `page ${name}`,
  joint: ", ",
  /** The notes of a lint that read nothing, as one error message. */
  space: " ",
  unread: (id: string, why: string) => `${id} was not read: ${why}`,
  more: (count: number, scope: string) =>
    `${count} more top layers in ${scope} were not linted: lint them with within, one page or frame at a time.`,
  cut: (
    root: { readonly id: string; readonly name: string },
    count: number,
    first: string,
  ) =>
    `The read of ${root.id} "${root.name}" stopped at its size budget, so ${count} layer${count === 1 ? "'s" : "s'"} children were not linted (first ${first}): lint them with within.`,
} as const;
