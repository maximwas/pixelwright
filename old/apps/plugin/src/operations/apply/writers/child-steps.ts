import type { FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { isSized, type SizedNode } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { flexOf, guarded, type Step } from "./step.ts";

type Sizing = "layoutSizingHorizontal" | "layoutSizingVertical";

/** How a layer sits in its parent's auto layout or grid. */
export const CHILD_STEPS: readonly Step[] = [
  {
    keys: ["grow"],
    ...guarded(isSized, "place in auto layout", grow),
  },
  {
    keys: ["alignSelf"],
    ...guarded(isSized, "place in auto layout", alignSelf),
  },
  {
    keys: ["justifySelf"],
    ...guarded(isSized, "place in a grid", justifySelf),
  },
  {
    keys: ["gridRow", "gridColumn"],
    ...guarded(isSized, "place in a grid", cell),
  },
];

/** What places a layer in its parent's layout: written once the parent has it. */
export const PLACING_KEYS: ReadonlySet<string> = new Set(CHILD_STEPS.flatMap(({ keys }) => keys));

/** flex: 1 fills the flex parent's direction. */
function grow(node: SizedNode, { grow: fill }: FigmaProps): void {
  const direction = flexOf(node.parent);

  if (direction === null && isGrid(node.parent)) {
    throw new WriteError(
      "flex fills a flex parent's direction: this layer's parent is a grid.",
      'Fill its cell with justify-self="stretch" and align-self="stretch".',
    );
  }

  if (direction === null) {
    throw new WriteError(
      "flex fills the direction of an auto layout parent: this layer's parent has no auto layout.",
      'Give the parent display="flex", or size the layer with width or height.',
    );
  }

  fillAxis(node, direction === "HORIZONTAL" ? "layoutSizingHorizontal" : "layoutSizingVertical", fill ?? false);
}

function fillAxis(node: SizedNode, sizing: Sizing, fill: boolean): void {
  if (fill) {
    assign(node, sizing, "FILL");
  } else if (node[sizing] === "FILL") {
    node[sizing] = "FIXED";
  }
}

/** In a flex parent, STRETCH fills across its direction; in a grid, the child's place in its cell, STRETCH filling it. */
function alignSelf(node: SizedNode, { alignSelf: align }: FigmaProps): void {
  const parent = node.parent;
  const direction = flexOf(parent);

  if (direction !== null) {
    if (align !== "STRETCH" && align !== "AUTO") {
      throw new WriteError(
        "Auto layout aligns its children together: align-self takes stretch or auto here.",
        "Set align-items on the parent.",
      );
    }

    fillAxis(node, direction === "HORIZONTAL" ? "layoutSizingVertical" : "layoutSizingHorizontal", align === "STRETCH");
  } else if (isGrid(parent)) {
    gridAlign(node, "Vertical", align);
  } else {
    throw new WriteError("align-self places a child of auto layout or a grid: this layer's parent has neither.");
  }
}

function justifySelf(node: SizedNode, { justifySelf: align }: FigmaProps): void {
  if (!isGrid(node.parent)) {
    throw new WriteError("justify-self places a grid's child in its cell: this layer's parent is no grid.");
  }

  gridAlign(node, "Horizontal", align);
}

function gridAlign(node: SizedNode, axis: "Horizontal" | "Vertical", align: FigmaProps["alignSelf"]): void {
  fillAxis(node, axis === "Horizontal" ? "layoutSizingHorizontal" : "layoutSizingVertical", align === "STRETCH");

  if (align !== "STRETCH") {
    assign(node, axis === "Horizontal" ? "gridChildHorizontalAlign" : "gridChildVerticalAlign", align ?? "AUTO");
  }
}

function cell(node: SizedNode, { gridRow, gridColumn }: FigmaProps): void {
  if (!isGrid(node.parent)) {
    throw new WriteError("grid-row and grid-column place a grid's child: this layer's parent is no grid.");
  }

  const row = gridRow?.anchor ?? node.gridRowAnchorIndex;
  const column = gridColumn?.anchor ?? node.gridColumnAnchorIndex;
  const spans = [
    ["gridRowSpan", gridRow?.span],
    ["gridColumnSpan", gridColumn?.span],
  ] as const;

  // A span that narrows goes before the move and one that widens after it: on the way the child never covers a cell
  // another child takes, which Figma refuses.
  for (const [key, span] of spans) {
    if (span !== undefined && span < node[key]) {
      node[key] = span;
    }
  }

  if (row !== node.gridRowAnchorIndex || column !== node.gridColumnAnchorIndex) {
    node.setGridChildPosition(row, column);
  }

  for (const [key, span] of spans) {
    if (span !== undefined) {
      assign(node, key, span);
    }
  }
}

function isGrid(node: BaseNode | null): boolean {
  return node !== null && "layoutMode" in node && node.layoutMode === "GRID";
}
