import {
  type AxisPlacement,
  centredAlong,
  coveredLength,
  differs,
  type FigmaProps,
  type Matrix,
  placementSpan,
  turnedAbout,
} from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { isSized, refusal, type SizedNode } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { resizeBox, standing } from "./size-steps.ts";
import { hasLayout, type Step } from "./step.ts";

type Axis = "horizontal" | "vertical";

/** The turn first: a turned layer is placed by its centre. */
export const TRANSFORM_STEPS: readonly Step[] = [
  {
    keys: ["rotation", "mirror"],
    write: (node, { rotation = 0, mirror = false }) => turnLayer(node, rotation, mirror),
  },
  {
    keys: ["horizontal"],
    write: (node, props) => place(node, "horizontal", props),
  },
  {
    keys: ["vertical"],
    write: (node, props) => place(node, "vertical", props),
  },
];

/** The turn and the mirror, about the layer's centre as CSS turns. */
export function turnLayer(node: SceneNode, rotation: number, mirror: boolean): void {
  if (!isSized(node)) {
    throw refusal(node, "turn");
  }

  moveTo(node, turnedAbout(node.relativeTransform, node, rotation, mirror));
}

function moveTo(node: SizedNode | SectionNode, next: Matrix): void {
  if (differs(next, node.relativeTransform)) {
    node.relativeTransform = next;
  }
}

/**
 * One axis of an absolute layer, from design_read's constraint: its edge offsets give where its unturned box starts,
 * and the layer is placed by its centre, as the read measured it. A group places its layers in its parent's space.
 */
function place(node: SceneNode, axis: Axis, props: FigmaProps): void {
  const spec = props[axis] as AxisPlacement;
  const parent = node.parent;

  if (parent === null) {
    return;
  }

  if (!isSized(node) && node.type !== "SECTION") {
    throw refusal(node, "place of its own");
  }

  if (hasLayout(parent) && (node.type === "SECTION" || node.layoutPositioning !== "ABSOLUTE")) {
    throw new WriteError(
      `${axis === "horizontal" ? "left and right" : "top and bottom"} place a layer with position="absolute": this one flows in its auto layout parent.`,
    );
  }

  const page = parent.type === "PAGE";

  if (page && spec.kind !== "MIN") {
    throw new WriteError("A layer on the page is placed by left and top alone.");
  }

  placeAlong(node, axis, spec, page ? 0 : lengthOf(parent, axis));
}

/** design_read places a level or standing line by the box it covers; other layers by their unturned box's centre. */
function placeAlong(node: SizedNode | SectionNode, axis: Axis, spec: AxisPlacement, span: number): void {
  const line = isLevelLine(node);
  const covered = coveredLength(node.relativeTransform, node, axis);
  const { start, size } = placementSpan(spec, span, line ? covered : lengthAlong(node, axis));

  if (!line && size !== lengthAlong(node, axis)) {
    resizeBox(
      node,
      axis === "horizontal" ? Math.max(size, 0.01) : node.width,
      axis === "vertical" ? Math.max(size, 0.01) : node.height,
    );
  }

  const centre = originOf(node, axis, spec) + start + (line ? covered : lengthAlong(node, axis)) / 2;

  moveTo(node, centredAlong(node.relativeTransform, node, axis, centre));
}

/** A line lying level or standing upright, which design_read measures by the box it covers. */
function isLevelLine(node: SizedNode | SectionNode): boolean {
  return node.type === "LINE" && (standing(node) || Math.abs(node.relativeTransform[0][1]) < 1e-6);
}

function lengthAlong(node: SizedNode | SectionNode, axis: Axis): number {
  return axis === "horizontal" ? node.width : node.height;
}

/** Where the parent's space starts: a group places its layers in its own parent's, other parents keep a constraint. */
function originOf(node: SizedNode | SectionNode, axis: Axis, spec: AxisPlacement): number {
  const parent = node.parent;

  if (parent?.type === "GROUP") {
    return parent[axis === "horizontal" ? "x" : "y"];
  }

  if (parent?.type !== "PAGE") {
    pin(node, axis, spec);
  }

  return 0;
}

function lengthOf(parent: BaseNode, axis: Axis): number {
  const value = axis === "horizontal" ? ("width" in parent ? parent.width : 0) : "height" in parent ? parent.height : 0;

  return typeof value === "number" ? value : 0;
}

/** The constraint design_read read the placement from, kept on the layer for its parent's resizes. */
function pin(node: SizedNode | SectionNode, axis: Axis, spec: AxisPlacement): void {
  if ("constraints" in node && typeof node.constraints === "object" && node.constraints !== null) {
    assign(node, "constraints", {
      ...node.constraints,
      [axis]: spec.kind,
    });
  }
}
