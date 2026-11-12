import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";

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

/** The read-only attribute design_read writes what a component's layer is bound to as, for what design_apply sets. */
export const UNCHANGED_READ_AS: Readonly<Record<string, string>> = {
  [ATTRIBUTE.prop]: DESIGN_ATTRIBUTE.prop,
  [ATTRIBUTE.visibleProp]: DESIGN_ATTRIBUTE.visibleProp,
  [ATTRIBUTE.swapProp]: DESIGN_ATTRIBUTE.swapProp,
};

export const UNCHANGED_VALUE = {
  /** design_read's read-only attributes start so: they complete no write. */
  readOnly: "$",
} as const;

/** sRGB colour literals (hex, rgb()) in a value, tried again in a Display P3 file's space. */
export const UNCHANGED_PATTERN = { srgb: /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)/g } as const;
