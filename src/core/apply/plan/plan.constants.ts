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
  switched: (where: string, to: string) =>
    `This layer is inside ${where}, which this call switches to another ${to}: Figma gives the instance's layers new ids then, so this layer is not written.`,
  switchedHint: (to: string) =>
    `Switch the ${to} first, read the instance again, then edit its layers by their new ids.`,
  standingFor: (source: string) => `the instance standing for ${source}`,
  copyOf: (source: string) => `the copy of ${source}`,
} as const;

export const PLAN_VALUE = {
  /** Display words the planner reads on a parent element. */
  none: "none",
  absolute: "absolute",
  block: "block",
  variantJoint: ", ",
  variantsJoint: "; ",
  variantPair: (name: string, value: string) => `${name}=${value}`,
  variant: "variant",
  component: "component",
  /** How a layer's id inside an instance starts: I<instance id>; (a nested instance's id has its I already). */
  insideInstance: (id: string) => `${id.startsWith("I") ? id : `I${id}`};`,
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
