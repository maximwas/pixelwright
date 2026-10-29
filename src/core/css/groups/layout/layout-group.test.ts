import { describe, expect, it } from "vitest";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const format = new NumberFormat();
const group = new LayoutGroup(new CssLength(new CssVar(new CssSplit()), format), format);

function child(id: string, visible = true): ReadLayer {
  return { id, name: id, type: "FRAME", visible, x: 0, y: 0, width: 10, height: 10, childCount: 0 };
}

/** A frame with two visible children unless the case says otherwise. */
function frame(fields: Partial<ReadLayer>): ReadLayer {
  const children = fields.children ?? [child("1:2"), child("1:3")];

  return { ...child("1:1"), children, childCount: children.length, ...fields };
}

/** `listed`: false for a read that did not list the layer's children. */
function cssOf(fields: Partial<ReadLayer>, listed = true) {
  const css = new CssDeclarations();
  const layer = frame(fields);

  if (!listed) {
    delete layer.children;
  }

  group.read({
    layer,
    parent: null,
    model: { model: 1, profile: "design", root: layer, styles: {}, variables: {} },
    css,
  });

  return css.build();
}

describe("LayoutGroup", () => {
  // C-030: auto layout reads as flex, the defaults (row, start, no wrap, no padding) left out.
  it("reads auto layout as flex: direction, padding, alignment and gap", () => {
    expect(
      cssOf({
        layoutMode: "VERTICAL",
        layoutWrap: "NO_WRAP",
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        primaryAxisAlignItems: "CENTER",
        counterAxisAlignItems: "MAX",
        itemSpacing: 8,
      }).properties,
    ).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
      ["padding", "24px"],
      ["justify-content", "center"],
      ["align-items", "flex-end"],
      ["gap", "8px"],
    ]);
    expect(
      cssOf({ layoutMode: "HORIZONTAL", paddingTop: 8, paddingRight: 16, paddingBottom: 4, paddingLeft: 16 })
        .properties,
    ).toEqual([
      ["display", "flex"],
      ["padding", "8px 16px 4px"],
    ]);
  });

  // C-031: a gap with fewer than two visible children spaces nothing; spread children space themselves.
  it("writes a gap only with two visible children or more, and not when the children are spread", () => {
    const gap = (fields: Partial<ReadLayer>, listed = true) =>
      cssOf({ layoutMode: "HORIZONTAL", itemSpacing: 12, ...fields }, listed).properties.find(
        ([name]) => name === "gap",
      );

    expect(gap({})).toEqual(["gap", "12px"]);
    expect(gap({ children: [child("1:2"), child("1:3", false)] })).toBeUndefined();
    expect(gap({ primaryAxisAlignItems: "SPACE_BETWEEN" })).toBeUndefined();
    // A read that did not list the children counts them by childCount.
    expect(gap({ childCount: 3 }, false)).toEqual(["gap", "12px"]);
  });

  // C-032: Figma lets children overlap by a negative spacing (avatar stacks); CSS gap cannot be negative.
  it("keeps a negative spacing as a note, never as gap", () => {
    const css = cssOf({ layoutMode: "HORIZONTAL", itemSpacing: -8 });

    expect(css.properties.find(([name]) => name === "gap")).toBeUndefined();
    expect(css.notes).toEqual([["gap", "-8px (the children overlap)"]]);
  });

  // C-033: CSS gap spaces wrapped lines too, so the line gap is written only when it differs, 0 included.
  it("writes the gap between wrapped lines only when it differs from the gap, 0 included", () => {
    const wrap = (
      itemSpacing: number,
      counterAxisSpacing: number | null,
      fields: Partial<ReadLayer> = {},
    ) =>
      cssOf({ layoutMode: "HORIZONTAL", layoutWrap: "WRAP", itemSpacing, counterAxisSpacing, ...fields }).properties;

    expect(wrap(12, 0)).toEqual([
      ["display", "flex"],
      ["flex-wrap", "wrap"],
      ["gap", "12px"],
      ["row-gap", "0"],
    ]);
    expect(wrap(12, 12)).toEqual([
      ["display", "flex"],
      ["flex-wrap", "wrap"],
      ["gap", "12px"],
    ]);
    // Figma's null line spacing follows the item spacing.
    expect(wrap(12, null)).toEqual(wrap(12, 12));
    expect(wrap(12, 16, { primaryAxisAlignItems: "SPACE_EVENLY", counterAxisAlignContent: "SPACE_BETWEEN" })).toEqual([
      ["display", "flex"],
      ["flex-wrap", "wrap"],
      ["justify-content", "space-evenly"],
      ["align-content", "space-between"],
      ["row-gap", "16px"],
    ]);
    // A vertical wrap's lines are columns.
    expect(wrap(10, 40, { layoutMode: "VERTICAL" })).toContainEqual(["column-gap", "40px"]);
  });

  it("reads a grid's tracks, gaps and padding: fr, px and auto, equal tracks as repeat()", () => {
    expect(
      cssOf({
        layoutMode: "GRID",
        gridColumnCount: 3,
        gridRowCount: 2,
        gridColumnSizes: [
          { type: "FLEX", value: 1 },
          { type: "FLEX", value: 1 },
          { type: "FIXED", value: 200 },
        ],
        gridRowSizes: [{ type: "HUG" }, { type: "HUG" }],
        gridColumnGap: 16,
        gridRowGap: 8,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
      }).properties,
    ).toEqual([
      ["display", "grid"],
      ["padding", "24px"],
      ["column-gap", "16px"],
      ["row-gap", "8px"],
      ["grid-template-columns", "1fr 1fr 200px"],
      ["grid-template-rows", "auto auto"],
    ]);
    // A read without track sizes (FX-008: they cost callback ids) still says how many columns there are.
    expect(cssOf({ layoutMode: "GRID", gridColumnCount: 4, gridRowCount: 1 }).properties).toEqual([
      ["display", "grid"],
      ["grid-template-columns", "repeat(4, 1fr)"],
    ]);
    expect(
      cssOf({ layoutMode: "GRID", gridColumnSizes: [1, 2, 3].map(() => ({ type: "FLEX", value: 1.5 })) }).properties,
    ).toContainEqual(["grid-template-columns", "repeat(3, 1.5fr)"]);
  });

  it("reads nothing for a frame without auto layout", () => {
    expect(cssOf({ layoutMode: "NONE", itemSpacing: 8 })).toEqual({ properties: [], notes: [] });
  });
});
