/** Words of the planner: why a named layer is refused, and what to do. */
export const PLAN_TEXT = {
  unread: (id: string) =>
    `design_apply could not read ${id}'s current state: the layers this call names, with every layer inside them, are more than one call reads.`,
  unreadHint:
    'Leave out the layers that stay as they are: an element alone (<Frame id="…"/>) moves or changes its layer with everything inside it. Or split the call.',
  variants: (
    name: string,
    wanted: string,
    has: string,
  ) => `${name} has no variant ${wanted}: it has ${has}.`,
} as const;

export const PLAN_VALUE = {
  /** Display words the planner reads on a parent element. */
  none: "none",
  absolute: "absolute",
  block: "block",
  variantJoint: ", ",
  variantsJoint: "; ",
  variantPair: (name: string, value: string) => `${name}=${value}`,
} as const;
