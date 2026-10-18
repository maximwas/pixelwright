import { SPACING_GRID } from "../../constants/css.ts";
import { px } from "../../css-mapping/values/format.ts";
import { visibleChildren } from "../../design/assets/classify.ts";
import { guessedLayoutCss } from "../../design/hints/layout-guess.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { findingOf, type LintRule } from "./lint-rule.ts";
import { rawNumbers } from "./raw-values.ts";

/** The grid spacing and radii are expected on. */

/** How far past its room a layer may reach before it counts: Figma's sub-pixel boxes and text metrics. */
const SLACK = 1;

/** The frames that lay out children: a frame or a main component (an instance's layout is its component's). */
const CONTAINERS: ReadonlySet<string> = new Set(["FRAME", "COMPONENT"]);

/** Stacks placed by hand that Figma itself reads as a flow: they will not resize as the build's flex does. */
export const NO_AUTO_LAYOUT: LintRule = {
  id: "no-auto-layout",
  severity: "warning",
  about: "Frames placing two children or more by hand that Figma reads as a row or a column.",
  check: ({ node, inInstance }) => {
    const children = visibleChildren(node);

    if (
      inInstance ||
      !CONTAINERS.has(node.type) ||
      node.layoutMode !== undefined ||
      node.inferredLayout === undefined
    ) {
      return [];
    }

    return children.length < 2
      ? []
      : [
          findingOf(NO_AUTO_LAYOUT, node, {
            message: `Places ${children.length} children by hand; Figma reads them as ${guessedLayoutCss(node.inferredLayout, children.length)}.`,
            fix: "Give it auto layout (design_apply with that display, gap and padding), so it resizes as the build will.",
          }),
        ];
  },
};

/** A layer's box, in the read's coordinates. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The room a parent gives a child in its flow or grid (its box less its padding); a clipping frame's own box. */
function roomOf(parent: SnapshotNode, child: SnapshotNode): Box | null {
  const flows = parent.layoutMode !== undefined && parent.layoutMode !== "NONE";

  if (flows && child.layoutPositioning !== "ABSOLUTE") {
    return {
      x: parent.x + (parent.paddingLeft ?? 0),
      y: parent.y + (parent.paddingTop ?? 0),
      width: parent.width - (parent.paddingLeft ?? 0) - (parent.paddingRight ?? 0),
      height: parent.height - (parent.paddingTop ?? 0) - (parent.paddingBottom ?? 0),
    };
  }

  // A clipping frame cuts what reaches past it: only a text cut that way is lost content.
  return parent.clipsContent && child.type === "TEXT" ? parent : null;
}

/** How far a box reaches past another on each axis. */
function pastOf(box: Box, room: Box): { x: number; y: number } {
  return {
    x: Math.max(0, room.x - box.x) + Math.max(0, box.x + box.width - (room.x + room.width)),
    y: Math.max(0, room.y - box.y) + Math.max(0, box.y + box.height - (room.y + room.height)),
  };
}

/** A grid child its own box overlaps: in a grid, children meet only when one reaches out of its cell. */
function overlapped(node: SnapshotNode, parent: SnapshotNode): SnapshotNode | undefined {
  if (parent.layoutMode !== "GRID" || node.layoutPositioning === "ABSOLUTE") {
    return undefined;
  }

  return visibleChildren(parent).find((other) => {
    const meet = (a: number, aSize: number, b: number, bSize: number) =>
      Math.min(a + aSize, b + bSize) - Math.max(a, b) > SLACK;

    return (
      other !== node &&
      other.layoutPositioning !== "ABSOLUTE" &&
      meet(node.x, node.width, other.x, other.width) &&
      meet(node.y, node.height, other.y, other.height)
    );
  });
}

/** Layers wider or taller than the room their parent gives them: a column's text past its cell, a cut-off label. */
export const OVERFLOW: LintRule = {
  id: "overflow",
  severity: "warning",
  about: "Layers reaching past the room their parent's flow, grid cell or clip gives them.",
  check: ({ node, parent }) => {
    const turned = Math.abs(node.rotation ?? 0) >= 0.5;
    const truncated = node.text?.textTruncation === "ENDING";
    const room = parent === null || turned || truncated ? null : roomOf(parent, node);
    const past = room === null ? null : pastOf(node, room);
    const other = parent === null || turned ? undefined : overlapped(node, parent);

    if (other !== undefined) {
      return [
        findingOf(OVERFLOW, node, {
          message: `Reaches out of its grid cell over ${other.id} "${other.name}".`,
          fix: "Let it wrap or shrink to its column, or span it over more cells (grid-column span).",
        }),
      ];
    }

    if (parent === null || past === null || (past.x <= SLACK && past.y <= SLACK)) {
      return [];
    }

    const axis = past.x > SLACK ? `${px(past.x)} wider` : `${px(past.y)} taller`;

    return [
      findingOf(OVERFLOW, node, {
        message: `${axis} than the room ${parent.id} "${parent.name}" gives it${parent.clipsContent ? ", which cuts it off" : ""}.`,
        fix:
          node.type === "TEXT"
            ? "Let it wrap (width fill, height auto), shorten it, or give its column more room."
            : "Let it fill its parent, or give the parent more room.",
      }),
    ];
  },
};

/** Spacing and radii off the 4 px grid, bound to no token. */
export const OFF_SCALE: LintRule = {
  id: "off-scale",
  severity: "info",
  about: "Gaps, padding and radii off the 4 px grid, bound to no token.",
  check: ({ node, inInstance }, { hints }) => {
    const pill = (amount: number) => amount >= Math.min(node.width, node.height) / 2 - SLACK;
    const off = inInstance
      ? []
      : rawNumbers(node).filter(
          ({ field, value, amount }) =>
            amount !== undefined &&
            amount > 2 &&
            amount % SPACING_GRID !== 0 &&
            (field === "gap" ||
              field === "row-gap" ||
              field === "column-gap" ||
              field === "padding" ||
              field === "border-radius") &&
            !(field === "border-radius" && pill(amount)) &&
            hints.of("number", field, value) === null,
        );

    return off.length === 0
      ? []
      : [
          findingOf(OFF_SCALE, node, {
            message: `Off the ${SPACING_GRID}px grid: ${off.map(({ field, value }) => `${field} ${value}`).join(", ")}.`,
            fix: "Round it to the scale, or snap it to a token with tokens_bind choose.",
          }),
        ];
  },
};
