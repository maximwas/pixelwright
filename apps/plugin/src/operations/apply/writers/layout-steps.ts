import type { FigmaProps, GridTrack } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { type FrameLikeNode, hasAutoLayout } from "../../../figma/capabilities.ts";
import { guarded, type Step, writeLength, writeLengths } from "./step.ts";
import type { WriteScope } from "./write-scope.ts";

type Frame = FrameLikeNode;
type Spacing = "itemSpacing" | "counterAxisSpacing" | "gridColumnGap" | "gridRowGap";

const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;

/** A step of the layer's own layout: frames only. */
const layoutStep = (
  keys: Step["keys"],
  write: (node: Frame, props: FigmaProps, scope: WriteScope) => void | Promise<void>,
): Step => ({
  keys,
  write: guarded(hasAutoLayout, "auto layout", async (node, props, scope) => {
    await write(node, props, scope);
  }),
});

const spacingStep = (key: Spacing) =>
  layoutStep([key], (node, props, scope) => writeLength(node, key, props[key] ?? 0, scope));

/** The layer's own layout, before anything sized in it: its mode, padding, gaps, alignment and grid. */
export const LAYOUT_STEPS: readonly Step[] = [
  layoutStep(["layoutMode"], (node, { layoutMode }) => {
    if (layoutMode !== undefined) {
      assign(node, "layoutMode", layoutMode);
    }
  }),
  layoutStep(["layoutWrap"], (node, { layoutWrap }) => {
    if (layoutWrap !== undefined) {
      assign(node, "layoutWrap", layoutWrap);
    }
  }),
  layoutStep(["padding"], (node, { padding }, scope) => writeLengths(node, PADDING, padding ?? [], scope)),
  spacingStep("itemSpacing"),
  spacingStep("counterAxisSpacing"),
  layoutStep(["primaryAxisAlignItems"], (node, { primaryAxisAlignItems: align }) => {
    if (align !== undefined) {
      assign(node, "primaryAxisAlignItems", align);
    }
  }),
  layoutStep(["counterAxisAlignItems"], (node, { counterAxisAlignItems: align }) => {
    if (align !== undefined) {
      assign(node, "counterAxisAlignItems", align);
    }
  }),
  layoutStep(["counterAxisAlignContent"], (node, { counterAxisAlignContent: align }) => {
    if (align !== undefined) {
      assign(node, "counterAxisAlignContent", align);
    }
  }),
  layoutStep(["gridColumns"], (node, { gridColumns }) => tracks(node, "Column", gridColumns ?? [])),
  layoutStep(["gridRows"], (node, { gridRows }) => tracks(node, "Row", gridRows ?? [])),
  spacingStep("gridColumnGap"),
  spacingStep("gridRowGap"),
];

/** A grid's tracks: how many, then their sizes. */
function tracks(node: Frame, axis: "Column" | "Row", sizes: readonly GridTrack[]): void {
  const copies = sizes.map((track) => ({ ...track }));

  if (axis === "Column") {
    assign(node, "gridColumnCount", sizes.length);
    assign(node, "gridColumnSizes", copies);
  } else {
    assign(node, "gridRowCount", sizes.length);
    assign(node, "gridRowSizes", copies);
  }
}
