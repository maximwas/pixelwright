/** variants_read as clients list it (tools.json pins every word): 0.7.0's words. */
export const VARIANTS_READ_TOOL = {
  name: "variants_read",
  title: "Read a component's states",
  description:
    "How each variant of a component set differs from its default one (the top-left, as Figma takes it), as nodes_diff says it: the attributes each changes as [the default's, this one's], the layers only one has, its properties, and the CSS pseudo-class a state value suggests (Hover → :hover, Pressed → :active, Focused → :focus-visible, Disabled → :disabled). Give the set, a variant or an instance. Build the default, then each state as its difference.",
} as const;

export const VARIANTS_READ_FIELD = {
  node: "A component set's id, or one of its variants', or an instance's: its set is read.",
} as const;
