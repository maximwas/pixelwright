import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { FigmaProps } from "../../figma-props.ts";
import { keywordRule } from "../../keyword-rule.ts";
import type { Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { boxShorthand, px } from "../../values/format.ts";
import { gapsOf } from "./gaps.ts";

/** Figma's main-axis alignment as justify-content; the start is the default and left out. */
const JUSTIFY_CSS: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
  SPACE_EVENLY: "space-evenly",
  SPACE_AROUND: "space-around",
};

/** Ways of spreading children that leave no room for a gap. */
const SPREAD = new Set(["SPACE_BETWEEN", "SPACE_EVENLY", "SPACE_AROUND"]);

/** Figma's cross-axis alignment as align-items; the start is the default and left out. */
const ALIGN_CSS: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "baseline",
};

const JUSTIFY_FIGMA: Readonly<Record<string, Exclude<FigmaProps["primaryAxisAlignItems"], undefined>>> = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  "space-between": "SPACE_BETWEEN",
  "space-evenly": "SPACE_EVENLY",
  "space-around": "SPACE_AROUND",
};

const ALIGN_FIGMA: Readonly<Record<string, Exclude<FigmaProps["counterAxisAlignItems"], undefined>>> = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  baseline: "BASELINE",
};

const ALIGN_CONTENT_FIGMA: Readonly<Record<string, Exclude<FigmaProps["counterAxisAlignContent"], undefined>>> = {
  normal: "AUTO",
  "flex-start": "AUTO",
  start: "AUTO",
  "space-between": "SPACE_BETWEEN",
};

/** The flex alignments, each one keyword. */
export const FLEX_ALIGNMENT_RULES: readonly Rule[] = [
  {
    attributes: ["justify-content"],
    write: keywordRule("justify-content", JUSTIFY_FIGMA, "primaryAxisAlignItems"),
  },
  {
    attributes: ["align-items"],
    write: keywordRule("align-items", ALIGN_FIGMA, "counterAxisAlignItems"),
  },
  {
    attributes: ["align-content"],
    write: keywordRule("align-content", ALIGN_CONTENT_FIGMA, "counterAxisAlignContent"),
  },
];

/**
 * Auto layout as flex: the direction, wrap, padding and alignment, the gap between the children (none when fewer than
 * two show, or when they are spread), and the gap between wrapped lines when it differs.
 */
export function readFlex(node: SnapshotNode, css: CssDeclarations): void {
  css.set("display", "flex");

  if (node.layoutMode === "VERTICAL") {
    css.set("flex-direction", "column");
  }

  if (node.layoutWrap === "WRAP") {
    css.set("flex-wrap", "wrap");
  }

  readPadding(node, css);
  readAlignment(node, css);
  readGap(node, css);

  if (node.layoutWrap === "WRAP") {
    readWrappedLines(node, css);
  }
}

function readPadding(node: SnapshotNode, css: CssDeclarations): void {
  const sides = (["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((key) =>
    css.length(key, node[key] ?? 0),
  );

  if (sides.some((side) => side !== "0")) {
    css.set("padding", boxShorthand(...(sides as [string, string, string, string])));
  }
}

function readAlignment(node: SnapshotNode, css: CssDeclarations): void {
  const justify = JUSTIFY_CSS[node.primaryAxisAlignItems ?? "MIN"];
  const align = ALIGN_CSS[node.counterAxisAlignItems ?? "MIN"];

  if (justify !== undefined) {
    css.set("justify-content", justify);
  }

  if (align !== undefined) {
    css.set("align-items", align);
  }
}

function readGap(node: SnapshotNode, css: CssDeclarations): void {
  const spaced = node.children?.filter((child) => child.visible).length ?? node.childCount;

  // Spreading spaces the children itself, and a gap with fewer than two children spaces nothing.
  if (SPREAD.has(node.primaryAxisAlignItems ?? "MIN") || spaced < 2) {
    return;
  }

  if ((node.itemSpacing ?? 0) < 0) {
    // Figma lets children overlap by a negative spacing (avatar stacks); CSS gap cannot be negative.
    css.readOnly("gap", `${px(node.itemSpacing ?? 0)} (the children overlap)`);
  } else {
    css.setLength("gap", "itemSpacing", node.itemSpacing);
  }
}

/**
 * Between wrapped lines: rows of a horizontal wrap, columns of a vertical one. CSS's gap spaces the lines too, so the
 * line gap is written only when it differs from the gap written, 0 included.
 */
function readWrappedLines(node: SnapshotNode, css: CssDeclarations): void {
  const between = node.layoutMode === "VERTICAL" ? "column-gap" : "row-gap";
  const lines =
    typeof node.counterAxisSpacing === "number" ? css.length("counterAxisSpacing", node.counterAxisSpacing) : undefined;

  if (lines !== undefined && lines !== (css.get("gap") ?? "0")) {
    css.set(between, lines);
  }

  if (node.counterAxisAlignContent === "SPACE_BETWEEN") {
    css.set("align-content", "space-between");
  }
}

/** A flex layout: the direction, wrap and the gaps along and across it; grid tracks are an error. */
export function flexLayout(input: WriteInput, out: WriteOutput): void {
  const direction = input.merged("flex-direction") ?? "row";

  if (direction !== "row" && direction !== "column") {
    out.fail(
      "flex-direction",
      `flex-direction="${direction}" is not one Figma has: row or column (auto layout has no reverse order).`,
    );

    return;
  }

  const vertical = direction === "column";
  const wrap = input.merged("flex-wrap");

  out.set(
    "layoutMode",
    vertical ? "VERTICAL" : "HORIZONTAL",
    input.merged("flex-direction") === undefined ? "display" : "flex-direction",
  );
  writeWrap(wrap, out);
  writeFlexGaps(input, out, vertical, wrap === "wrap");

  for (const name of ["grid-template-columns", "grid-template-rows"].filter(input.changed)) {
    out.fail(name, `${name} needs display="grid".`);
  }
}

function writeWrap(wrap: string | undefined, out: WriteOutput): void {
  if (wrap === undefined) {
    return;
  }

  if (wrap === "wrap" || wrap === "nowrap") {
    out.set("layoutWrap", wrap === "wrap" ? "WRAP" : "NO_WRAP", "flex-wrap");
  } else {
    out.fail("flex-wrap", `flex-wrap="${wrap}" is not one Figma has: wrap or nowrap.`);
  }
}

/** As in CSS: along a row the columns are spaced, along a column the rows; the other gap is between wrapped lines. */
function writeFlexGaps(input: WriteInput, out: WriteOutput, vertical: boolean, wraps: boolean): void {
  const { row, column } = gapsOf(input, out);
  const along = vertical ? row : column;
  const across = vertical ? column : row;

  if (along !== undefined) {
    out.set("itemSpacing", along.value, along.attribute);
  }

  if (across !== undefined && wraps) {
    out.set("counterAxisSpacing", across.value, across.attribute);
  }
}
