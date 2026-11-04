import { describe, expect, it } from "vitest";
import { GeometryGroup } from "@/core/css/groups/geometry/geometry-group.ts";
import { Placement } from "@/core/css/groups/geometry/placement.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format, new TokenNames());
const group = new GeometryGroup(new Placement(lengths, format), lengths, format);

function layer(fields: Partial<ReadLayer>): ReadLayer {
  return {
    id: "1:2",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    x: 280,
    y: 180,
    width: 100,
    height: 100,
    childCount: 0,
    ...fields,
  };
}

/** A 400 x 300 frame without auto layout at the read's origin, unless the case gives another parent. */
function frame(fields: Partial<ReadLayer> = {}): ReadLayer {
  return layer({ id: "1:1", name: "Frame", type: "FRAME", x: 0, y: 0, width: 400, height: 300, ...fields });
}

function cssOf(fields: Partial<ReadLayer>, parent: ReadLayer | null = frame()) {
  const css = new CssDeclarations();
  const own = layer(fields);
  const root = parent ?? own;

  group.read({ layer: own, parent, model: { model: 1, profile: "design", root, styles: {}, variables: {} }, css });

  return css.build().properties;
}

describe("GeometryGroup", () => {
  // The line as one border: a flat line is its length wide, a standing one its length tall, neither turned; any
  // other angle stays a turned flat line.
  it("sizes a flat or standing line along its length, unturned, and keeps another angle turned", () => {
    const line = (rotation: number) =>
      cssOf({ type: "LINE", width: 18, height: 0, rotation }, frame({ layoutMode: "HORIZONTAL" }));

    expect(line(0)).toEqual([["width", "18px"]]);
    expect(line(90)).toEqual([["height", "18px"]]);
    expect(line(-90.3)).toEqual([["height", "18px"]]);
    expect(line(60)).toEqual([
      ["width", "18px"],
      ["height", "0"],
      ["transform", "rotate(-60deg)"],
    ]);
  });

  it("places a standing line by its drawn box in a frame without layout", () => {
    const bounds = { x: 100, y: 100, width: 0, height: 18 };

    expect(cssOf({ type: "LINE", x: 100, y: 118, width: 18, height: 0, rotation: 90, bounds })).toEqual([
      ["position", "absolute"],
      ["left", "100px"],
      ["top", "100px"],
      ["height", "18px"],
    ]);
  });

  // C-050: the constraints of a layer placed in a frame without auto layout.
  it("pins a layer to the right and bottom edges (MAX)", () => {
    expect(cssOf({ constraints: { horizontal: "MAX", vertical: "MAX" } })).toEqual([
      ["position", "absolute"],
      ["right", "20px"],
      ["bottom", "20px"],
      ["width", "100px"],
      ["height", "100px"],
    ]);
  });

  it("keeps a layer's offset from the centre (CENTER) and scales it in percents (SCALE)", () => {
    expect(cssOf({ constraints: { horizontal: "CENTER", vertical: "SCALE" } })).toEqual([
      ["position", "absolute"],
      ["left", "calc(50% + 80px)"],
      ["top", "60%"],
      ["width", "100px"],
      ["height", "33.33%"],
    ]);
    expect(cssOf({ x: 200, constraints: { horizontal: "CENTER", vertical: "MIN" } })).toContainEqual(["left", "50%"]);
  });

  it("stretches a layer between both edges without a size of its own (STRETCH)", () => {
    expect(cssOf({ constraints: { horizontal: "STRETCH", vertical: "MIN" } })).toEqual([
      ["position", "absolute"],
      ["left", "280px"],
      ["right", "20px"],
      ["top", "180px"],
      ["height", "100px"],
    ]);
  });

  it("lets a group's layers keep their place whatever their constraints say", () => {
    expect(cssOf({ constraints: { horizontal: "MAX", vertical: "MAX" } }, frame({ type: "GROUP" }))).toContainEqual([
      "left",
      "280px",
    ]);
  });

  // C-050, C-057: Orbit's sticker, turned 8 degrees, placed by its bounds' centre; CSS turns the other way.
  it("places a turned layer by its bounds' centre and turns it with the sign flipped", () => {
    expect(
      cssOf(
        {
          x: 520,
          y: 292,
          width: 144,
          height: 28,
          rotation: 8.000000756261047,
          bounds: { x: 520, y: 271.96, width: 146.5, height: 47.77 },
        },
        frame({ width: 1200, height: 360 }),
      ),
    ).toEqual([
      ["position", "absolute"],
      ["left", "521px"],
      ["top", "282px"],
      ["width", "144px"],
      ["height", "28px"],
      ["transform", "rotate(-8deg)"],
    ]);
  });

  // K-068: Figma reports a horizontal flip as a -180 degree turn; only the matrix tells them apart.
  it("reads a horizontal flip Figma reports as -180 degrees as scaleX(-1), and a turned flip with its angle", () => {
    expect(cssOf({ rotation: -180, mirrorTransform: [-1, 0, 0, 1] })).toContainEqual(["transform", "scaleX(-1)"]);
    expect(cssOf({ rotation: 90, mirrorTransform: [0, 1, 1, 0] })).toContainEqual([
      "transform",
      "rotate(-90deg) scaleX(-1)",
    ]);
  });

  // C-054: the root always has its size; FILL is flex: 1 along the parent's direction and stretch across it.
  it("gives the read's root its width and height whatever its sizing", () => {
    expect(cssOf({ layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" }, null)).toEqual([
      ["width", "100px"],
      ["height", "100px"],
    ]);
  });

  it("fills a flex parent as flex: 1 along it and align-self: stretch across it, and leaves a hugging size out", () => {
    const row = frame({ layoutMode: "HORIZONTAL" });

    expect(cssOf({ layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" }, row)).toEqual([["flex", "1"]]);
    expect(
      cssOf({ layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FILL", minWidth: 40, maxWidth: 0 }, row),
    ).toEqual([
      ["width", "100px"],
      ["min-width", "40px"],
      ["align-self", "stretch"],
    ]);
  });

  // C-058: a grid child's cell as 1-based lines, `N / span M` past one track; in its cell it sits by its own
  // alignment, stretched on an axis it fills; one track and the cell's own (AUTO) alignment add nothing more.
  it("places a grid child by 1-based lines and aligns it in its cell, stretched where it fills", () => {
    const bento = frame({ layoutMode: "GRID", gridColumnCount: 3, gridRowCount: 2 });
    const cell = (fields: Partial<ReadLayer>) =>
      cssOf(
        {
          layoutSizingHorizontal: "FIXED",
          layoutSizingVertical: "FIXED",
          gridRowAnchorIndex: 0,
          gridColumnAnchorIndex: 0,
          gridRowSpan: 1,
          gridColumnSpan: 1,
          gridChildHorizontalAlign: "AUTO",
          gridChildVerticalAlign: "AUTO",
          ...fields,
        },
        bento,
      );

    expect(cell({ gridColumnSpan: 2, layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" })).toEqual([
      ["align-self", "stretch"],
      ["grid-row", "1"],
      ["grid-column", "1 / span 2"],
      ["justify-self", "stretch"],
    ]);
    expect(cell({ gridRowAnchorIndex: 1, gridColumnAnchorIndex: 1, gridColumnSpan: 2 })).toEqual([
      ["width", "100px"],
      ["height", "100px"],
      ["grid-row", "2"],
      ["grid-column", "2 / span 2"],
    ]);
    expect(
      cell({
        gridRowAnchorIndex: 1,
        width: 12,
        height: 12,
        gridChildHorizontalAlign: "CENTER",
        gridChildVerticalAlign: "MAX",
      }),
    ).toEqual([
      ["width", "12px"],
      ["height", "12px"],
      ["align-self", "end"],
      ["grid-row", "2"],
      ["grid-column", "1"],
      ["justify-self", "center"],
    ]);
  });
});
