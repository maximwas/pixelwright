import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { boxOf, lengthOf, splitTop } from "../../values/css-values.ts";
import { LAYOUT_TAGS } from "../../vocabulary.ts";
import { FLEX_ALIGNMENT_RULES, flexLayout, readFlex } from "./flex.ts";
import { gridLayout, readGrid } from "./grid.ts";

/** What auto layout is made of: the display and what only a layout has. */
const LAYOUT = [
  "display",
  "flex-direction",
  "flex-wrap",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
];

const DISPLAYS: Readonly<Record<string, "flex" | "grid" | "block" | "none">> = {
  flex: "flex",
  "inline-flex": "flex",
  grid: "grid",
  "inline-grid": "grid",
  block: "block",
  "inline-block": "block",
  none: "none",
};

/** A frame's layout written back: the display with its direction, wrap and gaps, the padding, the alignments. */
export const LAYOUT_RULES: readonly Rule[] = [
  {
    attributes: LAYOUT,
    write: layoutRule,
  },
  {
    attributes: ["padding"],
    write: paddingRule,
  },
  ...FLEX_ALIGNMENT_RULES,
];

/** Whether a layer lays its children out in a row or a column (auto layout). */
export function isFlex(node: SnapshotNode | null): boolean {
  return node?.layoutMode === "HORIZONTAL" || node?.layoutMode === "VERTICAL";
}

/** Whether a layer lays its children out at all: auto layout or a grid. */
export function hasLayout(node: SnapshotNode | null): boolean {
  return isFlex(node) || node?.layoutMode === "GRID";
}

/** A frame's own layout: a grid, auto layout as flex, or none. */
export function readLayout(node: SnapshotNode, css: CssDeclarations): void {
  if (node.layoutMode === "GRID") {
    readGrid(node, css);
  } else if (isFlex(node)) {
    readFlex(node, css);
  }
}

/** Auto layout: the direction, wrap and gaps, read together since a gap means another axis in another direction. */
function layoutRule(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;
  const display = merged("display");
  const mode = display === undefined ? "block" : DISPLAYS[display];

  if (mode === undefined) {
    out.fail(
      "display",
      `display="${display}" is not one Figma has: flex, grid, block (no auto layout) or none (hidden).`,
    );

    return;
  }

  if (mode === "none") {
    // Hidden: the layout it has stays for when it is shown again.
    out.set("visible", false, "display");

    return;
  }

  if (changed("display") && input.hidden) {
    out.set("visible", true, "display");
  }

  if (mode === "grid") {
    gridLayout(input, out);
  } else if (mode === "flex") {
    flexLayout(input, out);
  } else {
    if (display !== undefined && LAYOUT_TAGS.has(input.tag)) {
      out.set("layoutMode", "NONE", "display");
    }

    for (const name of LAYOUT.slice(1).filter(changed)) {
      out.fail(name, `${name} needs display="flex" or display="grid": without auto layout it spaces nothing.`);
    }
  }
}

function paddingRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("padding") ?? "";
  const sides = boxOf(splitTop(value, " ").map(lengthOf));

  if (sides === null) {
    out.fail("padding", `padding="${value}" is not 1 to 4 lengths in px or tokens.`);
  } else {
    out.set("padding", sides, "padding");
  }
}
