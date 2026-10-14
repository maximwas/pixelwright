import type { FigmaProps, LengthValue } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { isSized, refusal, type SizedNode } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { boundTo, hasLayout, type Step, writeLength } from "./step.ts";
import { turnLayer } from "./transform-steps.ts";
import type { WriteScope } from "./write-scope.ts";

type Limit = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";
type Sized = SizedNode;

const LIMITS: readonly Limit[] = ["minWidth", "maxWidth", "minHeight", "maxHeight"];

/** Where the layer flows in its parent's auto layout, then its size and the limits on it. */
export const SIZE_STEPS: readonly Step[] = [
  {
    keys: ["absolute"],
    write: positioning,
  },
  {
    keys: ["width"],
    write: (node, props, scope) => size(node, "width", props, scope),
  },
  {
    keys: ["height"],
    write: (node, props, scope) => size(node, "height", props, scope),
  },
  ...LIMITS.map(
    (key): Step => ({
      keys: [key],
      write: (node, props, scope) => limit(node, key, props[key], scope),
    }),
  ),
];

/** A frame without auto layout places every child itself: nothing to change there. */
function positioning(node: SceneNode, { absolute }: FigmaProps): void {
  if (!hasLayout(node.parent)) {
    return;
  }

  if (!isSized(node)) {
    throw refusal(node, "place in auto layout");
  }

  assign(node, "layoutPositioning", absolute ? "ABSOLUTE" : "AUTO");
}

async function size(node: SceneNode, axis: "width" | "height", props: FigmaProps, scope: WriteScope): Promise<void> {
  const value = props[axis];

  if (value === undefined) {
    return;
  }

  if (node.type === "SECTION") {
    sizeSection(node, axis, value);

    return;
  }

  if (!isSized(node)) {
    throw refusal(node, "size of its own");
  }

  if (value === "HUG") {
    hug(node, axis);

    return;
  }

  // The token's variable first: a size that cannot be written changes nothing.
  const resolved = typeof value === "number" ? value : await (await scope.tokens()).variable(value.token, "FLOAT");

  fix(node, axis);

  if (typeof resolved !== "number") {
    if (boundTo(node, axis) !== resolved.id) {
      node.setBoundVariable(axis, resolved);
    }

    return;
  }

  resizeTo(node, axis, resolved);
}

/** A section has no resize: it is sized without constraints, in pixels, neither hugging nor bound to a token. */
function sizeSection(node: SectionNode, axis: "width" | "height", value: NonNullable<FigmaProps["width"]>): void {
  if (value === "HUG") {
    throw new WriteError("A section is sized in pixels: it cannot hug what it holds.");
  }

  if (typeof value !== "number") {
    throw new WriteError("A section's size takes a number of pixels, not a token.");
  }

  resizeBox(
    node,
    axis === "width" ? Math.max(value, 0.01) : node.width,
    axis === "height" ? Math.max(value, 0.01) : node.height,
  );
}

/** A new size, as each layer takes it: a section without constraints, another keeping how it sizes itself. */
export function resizeBox(node: SizedNode | SectionNode, width: number, height: number): void {
  if (node.type !== "SECTION") {
    resizeKeeping(node, width, height);
  } else if (node.width !== width || node.height !== height) {
    node.resizeWithoutConstraints(width, height);
  }
}

const sizingOf = (axis: "width" | "height") => (axis === "width" ? "layoutSizingHorizontal" : "layoutSizingVertical");

/** Hugging its content: a text sizes itself to it, another layer hugs in auto layout. */
function hug(node: Sized, axis: "width" | "height"): void {
  if (node.type === "TEXT") {
    assign(
      node,
      "textAutoResize",
      axis === "width" || node.textAutoResize === "WIDTH_AND_HEIGHT" ? "WIDTH_AND_HEIGHT" : "HEIGHT",
    );
  } else {
    assign(node, sizingOf(axis), "HUG");
  }
}

/** A size of its own: a fixed width lets a text's height follow it, a fixed height fixes both. */
function fix(node: Sized, axis: "width" | "height"): void {
  if (node.type === "TEXT") {
    assign(
      node,
      "textAutoResize",
      axis === "height" ? "NONE" : node.textAutoResize === "WIDTH_AND_HEIGHT" ? "HEIGHT" : node.textAutoResize,
    );
  } else if (hasLayout(node) || hasLayout(node.parent)) {
    assign(node, sizingOf(axis), "FIXED");
  }
}

function resizeTo(node: Sized, axis: "width" | "height", value: number): void {
  if (node.type === "LINE") {
    // A line is as long as it is wide; a standing one is written with its height and stands upright, as read.
    if (node.width !== value) {
      node.resize(value, 0);
    }

    if (axis === "height" && !standing(node)) {
      turnLayer(node, -90, false);
    }

    return;
  }

  if (node[axis] !== value) {
    resizeKeeping(
      node,
      axis === "width" ? Math.max(value, 0.01) : node.width,
      axis === "height" ? Math.max(value, 0.01) : node.height,
    );
  }
}

/**
 * resize(), keeping how the layer sizes itself: Figma's resize fixes the size on both axes and stops a text sizing
 * itself, while the XML changed one size only.
 */
export function resizeKeeping(node: SizedNode, width: number, height: number): void {
  const horizontal = node.layoutSizingHorizontal;
  const vertical = node.layoutSizingVertical;
  const autoResize = node.type === "TEXT" ? node.textAutoResize : undefined;

  node.resize(width, height);

  if (horizontal !== undefined && node.layoutSizingHorizontal !== horizontal) {
    node.layoutSizingHorizontal = horizontal;
  }

  if (vertical !== undefined && node.layoutSizingVertical !== vertical) {
    node.layoutSizingVertical = vertical;
  }

  if (autoResize !== undefined && node.type === "TEXT" && node.textAutoResize !== autoResize) {
    node.textAutoResize = autoResize;
  }
}

/** A line turned upright (within half a degree), as design_read writes it: a height and its left border. */
export function standing(node: SceneNode): boolean {
  const [[a]] = node.relativeTransform;

  return Math.abs(a) < Math.sin((0.5 * Math.PI) / 180);
}

async function limit(node: SceneNode, key: Limit, value: LengthValue | null | undefined, scope: WriteScope) {
  if (value === undefined) {
    return;
  }

  if (!isSized(node)) {
    throw refusal(node, "size limits");
  }

  if (value === null) {
    if (boundTo(node, key) !== undefined) {
      node.setBoundVariable(key, null);
    }

    assign(node, key, null);

    return;
  }

  await writeLength(node, key, value, scope);
}
