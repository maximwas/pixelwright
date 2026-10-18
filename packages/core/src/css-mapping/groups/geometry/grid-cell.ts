import { keywordRule } from "../../keyword-rule.ts";
import type { ReadScope, Rule } from "../../property-group.ts";
import { SELF_CSS, SELF_FIGMA } from "./self-align.ts";

/** Where a grid's child sits (1-based lines in CSS) and how it aligns in its cell. */
export function readGridCell({ node, parent, css }: ReadScope): void {
  if (parent?.layoutMode !== "GRID" || node.layoutPositioning === "ABSOLUTE") {
    return;
  }

  const place = (anchor: number | undefined, span: number | undefined) =>
    anchor === undefined ? undefined : (span ?? 1) > 1 ? `${anchor + 1} / span ${span}` : String(anchor + 1);
  const cell = [
    ["grid-row", place(node.gridRowAnchorIndex, node.gridRowSpan)],
    ["grid-column", place(node.gridColumnAnchorIndex, node.gridColumnSpan)],
    // Filling the cell (Figma's FILL in a grid) is stretch, as design_apply writes it; else the child's alignment.
    [
      "justify-self",
      node.layoutSizingHorizontal === "FILL" ? "stretch" : SELF_CSS[node.gridChildHorizontalAlign ?? "AUTO"],
    ],
    ["align-self", node.layoutSizingVertical === "FILL" ? "stretch" : SELF_CSS[node.gridChildVerticalAlign ?? "AUTO"]],
  ] as const;

  for (const [property, value] of cell) {
    if (value !== undefined) {
      css.set(property, value);
    }
  }
}

/** A grid cell written back: the child's alignment along the row, and the lines it spans. */
export const GRID_CELL_RULES: readonly Rule[] = [
  {
    attributes: ["justify-self"],
    write: keywordRule("justify-self", SELF_FIGMA, "justifySelf"),
  },
  {
    attributes: ["grid-row"],
    write: spanRule("grid-row", "gridRow"),
  },
  {
    attributes: ["grid-column"],
    write: spanRule("grid-column", "gridColumn"),
  },
];

/** "N", "N / span M" or "N / M", lines counted from 1, as Figma's first track (from 0) and span. */
function spanRule(attribute: string, key: "gridRow" | "gridColumn"): Rule["write"] {
  return ({ own }, out) => {
    const value = (own(attribute) ?? "").trim();
    const match = /^(\d+)(?:\s*\/\s*(?:span\s+(\d+)|(\d+)))?$/.exec(value);
    const first = Number(match?.[1]);
    const span = match?.[2] !== undefined ? Number(match[2]) : match?.[3] !== undefined ? Number(match[3]) - first : 1;

    if (match === null || first < 1 || span < 1) {
      out.fail(attribute, `${attribute}="${value}" is not "N", "N / span M" or "N / M", lines counted from 1.`);
    } else {
      out.set(
        key,
        {
          anchor: first - 1,
          span,
        },
        attribute,
      );
    }
  };
}
