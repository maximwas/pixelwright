import { describe, expect, it } from "vitest";
import { CssReader } from "@/core/css/css-reader.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
import { TextPathData } from "@/core/css/groups/text/text-path-data.ts";
import { TextRun } from "@/core/css/groups/text/text-run.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { AssetClassifier } from "@/core/design/assets/asset-classifier.ts";
import { AssetCss } from "@/core/design/assets/asset-css.ts";
import { AssetPlanner } from "@/core/design/assets/asset-planner.ts";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { ComponentAttributes } from "@/core/design/component/component-attributes.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { DesignDiff } from "@/core/diff/design-diff.ts";
import { Fingerprint } from "@/core/diff/fingerprint.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's tree with the fills group: what a diff compares, built as the server root binds it. */
const format = new NumberFormat();
const names = new TokenNames();
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const solid = new SolidPaint(names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const tree = new LayerTree(
  new DesignBuilder(
    new NodeTag(),
    new ComponentAttributes(new NameValueList(), new TokenNames()),
    new CssReader(new GroupRegistry([new FillsGroup(paints)])),
    new TextPathData(),
  ),
  new TextContent(new TextRun(new FontShorthand(format), paints, format, names)),
  new InteractionAttributes(new EasingCss(format)),
  new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit())),
);

const diff = new DesignDiff(tree, new Fingerprint());

type Segment = NonNullable<ReadLayer["text"]>["segments"][number];

const RED = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };
const BLUE = { ...RED, color: { r: 0, g: 0, b: 1 } };

function layer(fields: Partial<ReadLayer> & Pick<ReadLayer, "id" | "name">): ReadLayer {
  return {
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}

function icon(id: string, pathHash: string): ReadLayer {
  return layer({ id, name: "flask", type: "VECTOR", fills: [RED], pathHash });
}

/** A screen in auto layout (a frame of shapes alone reads as one Icon), placed at x. */
function screen(
  id: string,
  x: number,
  children: ReadLayer[],
): ReadModel {
  const root = layer({
    id,
    name: `Screen ${id}`,
    type: "FRAME",
    x,
    width: 360,
    height: 640,
    layoutMode: "VERTICAL",
    children,
  });

  return { model: 1, profile: "design", root, styles: {}, variables: {} };
}

function segment(
  characters: string,
  start: number,
  fontWeight: number,
): Segment {
  return {
    characters,
    start,
    end: start + characters.length,
    fontName: { family: "Inter", style: fontWeight === 400 ? "Regular" : "Bold" },
    fontSize: 16,
    fontWeight,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
  };
}

/** A text whose runs alternate regular and bold, the regular ones first. */
function promo(id: string, runs: readonly string[]): ReadModel {
  const segments = runs.map((characters, index) =>
    segment(characters, runs.slice(0, index).join("").length, index % 2 === 0 ? 400 : 700),
  );
  const text = layer({
    id: `${id}:2`,
    name: "Promo",
    type: "TEXT",
    text: {
      characters: runs.join(""),
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
  });

  return screen(`${id}:1`, 0, [text]);
}

const variantA = () => screen("10:1", 0, [layer({ id: "10:2", name: "Card", fills: [RED] }), icon("10:3", "path-a")]);

describe("DesignDiff", () => {
  // K-051: ids and the roots' own names and places are no difference.
  it("finds nothing between a screen and an equal one elsewhere", () => {
    const other = screen("20:1", 400, [layer({ id: "20:2", name: "Card", fills: [RED] }), icon("20:3", "path-a")]);

    expect(diff.diff(variantA(), other)).toEqual({ same: true, onlyInA: [], onlyInB: [], changed: [] });
  });

  it("names a layer whose attribute changed by its path, with both values", () => {
    const other = screen("20:1", 0, [layer({ id: "20:2", name: "Card", fills: [BLUE] }), icon("20:3", "path-a")]);

    expect(diff.diff(variantA(), other).changed).toEqual([
      { path: 'Rectangle "Card"', a: "10:2", b: "20:2", attributes: { background: ["#F00", "#00F"] } },
    ]);
  });

  // K-052: the icon's name, size and file are the same; what draws it is not.
  it("tells an icon whose drawing differs", () => {
    const other = screen("20:1", 0, [layer({ id: "20:2", name: "Card", fills: [RED] }), icon("20:3", "path-b")]);

    expect(diff.diff(variantA(), other).changed).toEqual([
      { path: 'Icon "flask"', a: "10:3", b: "20:3", attributes: {}, drawing: true },
    ]);
  });

  it("lists the layers only one side has", () => {
    const other = screen("20:1", 0, [
      layer({ id: "20:2", name: "Card", fills: [RED] }),
      layer({ id: "20:4", name: "Badge" }),
    ]);

    expect(diff.diff(variantA(), other)).toMatchObject({
      same: false,
      onlyInA: [{ path: 'Icon "flask"', id: "10:3" }],
      onlyInB: [{ path: 'Rectangle "Badge"', id: "20:4" }],
    });
  });

  it("compares a text's characters around its spans, and its spans in order as layers of the text", () => {
    const found = diff.diff(promo("10", ["Save ", "20%", " today"]), promo("20", ["Save ", "30%", " today", "!"]));

    expect(found).toEqual({
      same: false,
      onlyInA: [],
      onlyInB: [{ path: 'Text "Promo" / Span ""[2]', id: "" }],
      changed: [{ path: 'Text "Promo" / Span ""', a: "", b: "", attributes: { $text: ["20%", "30%"] } }],
    });
  });
});
