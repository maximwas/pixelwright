import { describe, expect, it } from "vitest";
import { AppearanceGroup } from "@/core/css/groups/appearance/appearance-group.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const format = new NumberFormat();
const group = new AppearanceGroup(new CssLength(new CssVar(new CssSplit()), format, new TokenNames()), format);

function cssOf(fields: Partial<ReadLayer>) {
  const css = new CssDeclarations();
  const layer: ReadLayer = {
    id: "1:1",
    name: "Box",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 56,
    height: 56,
    childCount: 0,
    ...fields,
  };

  group.read({
    layer,
    parent: null,
    model: { model: 1, profile: "design", root: layer, styles: {}, variables: {} },
    css,
  });

  return css.build();
}

describe("AppearanceGroup", () => {
  // C-070: opacity, a blend mode CSS has, clipping; a blend mode it has not is a note, with Figma's own CSS if read.
  it("reads opacity, the blend mode and clipping, and notes a blend mode CSS has not", () => {
    expect(cssOf({ opacity: 0.5, blendMode: "LINEAR_BURN", clipsContent: true }).properties).toEqual([
      ["opacity", "0.5"],
      ["mix-blend-mode", "plus-darker"],
      ["overflow", "hidden"],
    ]);
    expect(cssOf({ blendMode: "PLUS_ONE" }).notes).toEqual([["mix-blend-mode", "plus-one"]]);
  });

  // C-071: an ellipse is round, mixed corners are four values top left first.
  it("draws an ellipse's radius as 50% and mixed corners as four values", () => {
    expect(cssOf({ type: "ELLIPSE" }).properties).toEqual([["border-radius", "50%"]]);
    expect(
      cssOf({ cornerRadius: "mixed", topLeftRadius: 8, topRightRadius: 8, bottomRightRadius: 0, bottomLeftRadius: 0 })
        .properties,
    ).toEqual([["border-radius", "8px 8px 0 0"]]);
    expect(cssOf({ type: "VECTOR", cornerRadius: 4 }).properties).toEqual([]);
  });

  // C-072: layout grids are read only, columns and a square grid alike.
  it("notes the visible layout grids as layout-grid", () => {
    expect(
      cssOf({
        layoutGrids: [
          { pattern: "COLUMNS", alignment: "STRETCH", count: 12, gutterSize: 24, offset: 80, visible: true },
          { pattern: "ROWS", alignment: "MIN", count: 4, sectionSize: 40, gutterSize: 8, offset: 0, visible: false },
          { pattern: "GRID", sectionSize: 8, visible: true },
        ],
      }).notes,
    ).toEqual([["layout-grid", "12 columns stretch, gutter 24px, margin 80px + 8px grid"]]);
  });

  // C-073: a truncated one-line text is CSS's ellipsis; more lines are a line clamp, read-only.
  it("reads a text truncated on one line as an ellipsis and on more lines as a line-clamp note", () => {
    const text = {
      characters: "Hi",
      textAutoResize: "NONE",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    };

    expect(cssOf({ type: "TEXT", text: { ...text, textTruncation: "ENDING" } }).properties).toEqual([
      ["overflow", "hidden"],
      ["text-overflow", "ellipsis"],
      ["white-space", "nowrap"],
    ]);
    expect(cssOf({ type: "TEXT", text: { ...text, textTruncation: "ENDING", maxLines: 3 } }).notes).toEqual([
      ["line-clamp", "3"],
    ]);
  });
});
