/** nodes_find's bounds both sides read (T-040), as 0.7.0 took them. */
export const FIND = {
  /** What a search names: 1 to 200 characters. */
  minChars: 1,
  maxChars: 200,
  /** Fifty layers by default, five hundred at most: past them, search within less. */
  defaultLimit: 50,
  minLimit: 1,
  maxLimit: 500,
  /** A count lists a component and variant only when an instance uses it. */
  minCount: 1,
} as const;

/** The counts' key of a component and variant, on both sides (T-042): the plugin tallies, the server adds pages up. */
export const FIND_COUNT = {
  key: (component: string, variant: string | undefined) => `${component}\n${variant ?? ""}`,
} as const;

export const FIND_FIELD = {
  variant: "With variant: the values matched, as the filter was read.",
  counts:
    "With counts: the instances found, by component and variant, in the order first met. A variant no instance uses is not listed.",
  countsCut: "The time ran out before every layer was counted: counts cover the layers reached. Search within less.",
  component: "The component set's name, or a component's without variants.",
  componentVariant: "The variant as Figma names it.",
  hidden: "The layer or one of its ancestors is hidden: a viewer does not see it.",
  fontSize: "A text's font size in px, or its distinct sizes in text order when it mixes them.",
  changed:
    "An instance's component properties whose value differs from the component's default, by name: what this copy changes.",
} as const;
