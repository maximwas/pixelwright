import type { SelfAlign } from "../../figma-props.ts";

/** A grid child's alignment in its cell as CSS; AUTO (the cell's own) is left out. */
export const SELF_CSS: Readonly<Record<string, string>> = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
};

/** align-self and justify-self as Figma takes them, in a grid cell or across a flex parent. */
export const SELF_FIGMA: Readonly<Record<string, SelfAlign>> = {
  auto: "AUTO",
  normal: "AUTO",
  start: "MIN",
  "flex-start": "MIN",
  "self-start": "MIN",
  center: "CENTER",
  end: "MAX",
  "flex-end": "MAX",
  "self-end": "MAX",
  stretch: "STRETCH",
};
