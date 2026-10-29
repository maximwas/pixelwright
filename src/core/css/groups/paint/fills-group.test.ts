import { describe, expect, it } from "vitest";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const group = new FillsGroup(new PaintList(new SolidPaint()));
const RED = { r: 1, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 1 };

function layer(fields: Partial<ReadLayer>): ReadLayer {
  return {
    id: "1:2",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    childCount: 0,
    ...fields,
  };
}

function cssOf(fields: Partial<ReadLayer>, styles: ReadModel["styles"] = {}) {
  const css = new CssDeclarations();
  const own = layer(fields);

  group.read({
    layer: own,
    parent: null,
    model: { model: 1, profile: "design", root: own, styles, variables: {} },
    css,
  });

  return css.build();
}

describe("FillsGroup", () => {
  // C-080: Figma's paints are bottom first, CSS's backgrounds top first; only the bottom one may be a plain colour.
  it("writes fills as a top-first background list, a solid above the bottom as a flat gradient, hidden ones left out", () => {
    expect(
      cssOf({
        fills: [
          { type: "SOLID", color: RED },
          { type: "SOLID", color: { r: 0, g: 1, b: 0 }, visible: false },
          { type: "SOLID", color: BLUE, opacity: 0.5 },
        ],
      }).properties,
    ).toEqual([["background", "linear-gradient(rgba(0, 0, 255, 0.5), rgba(0, 0, 255, 0.5)), #F00"]]);
  });

  it("writes a text's fill as its color, and nothing for a vector's", () => {
    expect(cssOf({ type: "TEXT", fills: [{ type: "SOLID", color: BLUE }] }).properties).toEqual([["color", "#00F"]]);
    expect(cssOf({ type: "VECTOR", fills: [{ type: "SOLID", color: BLUE }] }).properties).toEqual([]);
  });

  it("writes a fill bound to a paint style as the style's token", () => {
    const styles = { "S:1,": { name: "Orbit/Gradient", type: "PAINT", remote: false, paints: [] } };

    expect(cssOf({ fills: [{ type: "SOLID", color: RED }], fillStyleId: "S:1," }, styles).properties).toEqual([
      ["background", "var(--Orbit-Gradient)"],
    ]);
  });

  // D-20: a paint the table cannot write gets the fixed note, never Figma's own CSS (getCSSAsync hangs and is wrong).
  it("notes a paint it cannot write with the fixed text, not Figma's CSS", () => {
    const read = cssOf({ fills: [{ type: "GRADIENT_DIAMOND" }], css: { background: "figma's own" } });

    expect(read.properties).toEqual([]);
    expect(read.notes).toEqual([["background", "a gradient or other fill the table cannot write yet"]]);
  });
});
