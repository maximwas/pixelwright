/** The outline's attributes, in the order it writes them (C-009). */
export const OUTLINE_ATTRIBUTE = {
  id: "id",
  name: "name",
  component: "component",
  variant: "variant",
  x: "x",
  y: "y",
  width: "width",
  height: "height",
  hidden: "hidden",
  dev: "dev",
  /** How many children a layer has when some are not listed: outline it on its own. */
  children: "$children",
} as const;
