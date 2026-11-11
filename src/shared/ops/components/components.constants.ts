/** components_read's bounds both sides read (T-190), as 0.7.0 took them. */
export const COMPONENTS = {
  /** A name substring: 1 to 200 characters. */
  minChars: 1,
  maxChars: 200,
  /** A hundred components by default; five hundred at most, what a library save asks for (T-193). */
  defaultLimit: 100,
  minLimit: 1,
  maxLimit: 500,
  /** A hundred instances listed per component: past them, nodes_find componentId lists them page by page. */
  instancesCap: 100,
} as const;

/** used: the components the instances in a layer come from; local: the ones the file defines (T-190). */
export const COMPONENTS_SCOPE = { local: "local", used: "used" } as const;

/** What the components op lists: a component of its own, or a set with its variants under it. */
export const COMPONENT_TYPE = { component: "COMPONENT", set: "COMPONENT_SET" } as const;

export const COMPONENTS_FIELD = {
  on: "The variant of a set the link is on.",
  instanceNodes:
    "With instances: the component's instances (a set's, of every variant), each with its page; 100 at most.",
  instanceNodesMore: "There are more than the 100 instances listed.",
  references: "With references: per property, the layers inside the component bound to it, and the field each binds.",
} as const;
