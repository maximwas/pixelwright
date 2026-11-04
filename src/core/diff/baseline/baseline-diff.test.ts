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
import { BaselineDiff } from "@/core/diff/baseline/baseline-diff.ts";
import { LayerChanges } from "@/core/diff/baseline/layer-changes.ts";
import { StructureChanges } from "@/core/diff/baseline/structure-changes.ts";
import { Fingerprint } from "@/core/diff/fingerprint.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's tree with the fills group, and the baseline diff over it, built as the server root binds them. */
const format = new NumberFormat();
const names = new TokenNames();
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const solid = new SolidPaint(names);
const urls = new CssUrl(new CssSplit());
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(urls),
  names,
);
const tree = new LayerTree(
  new DesignBuilder(
    new NodeTag(),
    new ComponentAttributes(new NameValueList(), names),
    new CssReader(new GroupRegistry([new FillsGroup(paints)])),
    new TextPathData(),
  ),
  new TextContent(new TextRun(new FontShorthand(format), paints, format, names)),
  new InteractionAttributes(new EasingCss(format)),
  new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit())),
);
const writer = new XmlWriter(new XmlEscape());
const baselines = new BaselineDiff(
  tree,
  new LayerChanges(new Fingerprint(), urls, new NameValueList(), writer),
  new StructureChanges(writer),
);

const RED = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };
const BLUE = { ...RED, color: { r: 0, g: 0, b: 1 } };
const image = (hash: string) => ({ type: "IMAGE", visible: true, imageHash: hash, scaleMode: "FILL" });

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

function text(id: string, characters: string): ReadLayer {
  const run = {
    characters,
    start: 0,
    end: characters.length,
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
  };
  const segments = [run];

  return layer({
    id,
    name: characters,
    type: "TEXT",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
  });
}

/** A frame in auto layout: a frame of shapes alone reads as one Icon. */
function column(
  id: string,
  name: string,
  children: ReadLayer[],
  extra: Partial<ReadLayer> = {},
): ReadLayer {
  return layer({ id, name, type: "FRAME", layoutMode: "VERTICAL", children, ...extra });
}

function icon(id: string, pathHash = "a1"): ReadLayer {
  return layer({ id, name: "Arrow", type: "VECTOR", width: 24, height: 24, fills: [RED], pathHash });
}

function model(root: ReadLayer, page?: { id: string; name: string }): ReadModel {
  return { model: 1, profile: "design", root, styles: {}, variables: {}, ...(page === undefined ? {} : { page }) };
}

function diff(
  before: ReadModel,
  after: ReadModel,
  sameReader = true,
) {
  return baselines.compare({ snapshot: before, tokens: null }, { snapshot: after, tokens: null }, sameReader);
}

const pricing = column("1:1", "Pricing", [
  column("1:2", "Plans", [layer({ id: "1:3", name: "Swatch", fills: [RED] }), text("1:4", "Note")]),
]);

describe("BaselineDiff: layers (K-055)", () => {
  it("finds nothing between a read and itself", () => {
    expect(diff(model(pricing), model(pricing))).toMatchObject({ same: true, more: 0, notes: [] });
  });

  it("reports changes by id with their path, the root's rename and page but not its place", () => {
    const after = column(
      "1:1",
      "Pricing v2",
      [column("1:2", "Plan list", [layer({ id: "1:3", name: "Swatch", fills: [BLUE] }), text("1:4", "Note")])],
      { x: 400 },
    );
    const result = diff(model(pricing, { id: "0:1", name: "Draft" }), model(after, { id: "0:2", name: "Final" }));

    expect(result.changes.changed.map(({ path, attributes }) => [path, attributes])).toEqual([
      ["(root)", { name: ["Pricing", "Pricing v2"], $page: ["Draft", "Final"] }],
      ['Frame "Plan list"', { name: ["Plans", "Plan list"] }],
      ['Frame "Plan list" / Rectangle "Swatch"', { background: ["#F00", "#00F"] }],
    ]);
    expect(result.counts).toMatchObject({ changed: 3, added: 0, removed: 0, moved: 0, reordered: 0 });
  });

  it("lists a layer moved to another parent with where it was, and children in another order", () => {
    const swatch = layer({ id: "1:3", name: "Swatch", fills: [RED] });
    const moved = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:4", "Note")]), swatch]);
    const reordered = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:4", "Note"), swatch])]);

    expect(diff(model(pricing), model(moved)).changes.moved).toEqual([
      { path: 'Rectangle "Swatch"', id: "1:3", from: 'Frame "Plans"' },
    ]);
    expect(diff(model(pricing), model(reordered)).changes.reordered).toEqual([
      {
        path: 'Frame "Plans"',
        id: "1:2",
        before: ['Rectangle "Swatch"', 'Text "Note"'],
        after: ['Text "Note"', 'Rectangle "Swatch"'],
      },
    ]);
  });

  it("pairs a layer made again by its tag and name, and lists only the topmost when every id is new", () => {
    const pasted = column("1:1", "Pricing", [
      column("1:2", "Plans", [layer({ id: "1:3", name: "Swatch", fills: [RED] }), text("9:9", "Note")]),
    ]);
    const remade = column("9:1", "Pricing", [
      column("9:2", "Plans", [layer({ id: "9:3", name: "Swatch", fills: [RED] }), text("9:4", "Note")]),
    ]);

    expect(diff(model(pricing), model(pasted)).changes).toMatchObject({
      changed: [{ path: 'Frame "Plans" / Text "Note"', id: "9:9", was: "1:4", tag: "Text", attributes: {} }],
      added: [],
    });
    expect(diff(model(pricing), model(remade)).changes.changed).toEqual([
      { path: "(root)", id: "9:1", was: "1:1", tag: "Frame", attributes: {} },
    ]);
  });

  it("says a layer shown again was hidden and a layer hidden now is removed, nothing under either", () => {
    const hidden = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:4", "Note")], { visible: false })]);

    expect(diff(model(hidden), model(pricing)).changes.added).toEqual([
      expect.objectContaining({
        path: 'Frame "Plans"',
        id: "1:2",
        was: "hidden",
        xml: expect.stringMatching(/^<Frame id="1:2"/),
      }),
    ]);
    expect(diff(model(pricing), model(hidden)).changes.removed).toEqual([
      { path: 'Frame "Plans"', id: "1:2", tag: "Frame", now: "hidden" },
    ]);
  });

  it("gives a text's content as its XML, and only the props that differ", () => {
    const card = (price: string) =>
      layer({
        id: "2:1",
        name: "Card",
        type: "INSTANCE",
        instance: {
          componentId: "C:1",
          componentName: "Plan Card",
          properties: {
            "Price#1:0": { type: "TEXT", value: price },
            "Plan#1:1": { type: "TEXT", value: "Pro, yearly" },
          },
        },
      });
    const page = (price: string, note: string) => model(column("1:1", "Page", [text("1:2", note), card(price)]));
    const [footnote, instance] = diff(page("$12", "Taxes apply."), page("$14", "Billed <yearly>.")).changes.changed;

    expect(footnote?.attributes.$text).toEqual(["Taxes apply.", "Billed &lt;yearly&gt;."]);
    expect(instance?.attributes.props).toEqual(["Price=$12", "Price=$14"]);
  });
});

describe("BaselineDiff: cuts and drawings (K-055)", () => {
  // The read's budget can cut a parent mid-children (m:ec973ea3): nothing under it is paired, on either side.
  it("compares a parent whose children were cut, on either side, but nothing under it", () => {
    const whole = column("1:1", "Page", [column("1:2", "List", [text("1:3", "A"), text("1:4", "B")])]);
    const cut = column("1:1", "Page", [column("1:2", "List", [text("1:3", "A")], { childCount: 2 })]);

    for (const [before, after] of [
      [whole, cut],
      [cut, whole],
    ] as const) {
      expect(diff(model(before), model(after)).changes).toMatchObject({
        added: [],
        removed: [],
        changed: [],
        notCompared: [{ path: 'Frame "List"', id: "1:2", what: "children" }],
      });
    }
  });

  // design_read plans asset files in document order (m:ec973ea3): a new icon renumbers the src and url() after it.
  it("ignores src and an emptied url(), and tells a drawing or an image changed by what draws it", () => {
    const hero = (id: string, hash: string) => column(id, "Hero", [text(`${id}t`, "Hi")], { fills: [image(hash)] });
    const before = model(column("1:1", "Page", [text("1:9", "Hi"), icon("1:2"), hero("1:6", "h1")]));
    const inserted = model(
      column("1:1", "Page", [text("1:9", "Hi"), icon("1:5"), icon("1:2"), hero("1:7", "h2"), hero("1:6", "h1")]),
    );
    const redrawn = model(column("1:1", "Page", [text("1:9", "Hi"), icon("1:2", "b2"), hero("1:6", "h3")]));

    expect(diff(before, inserted).changes).toMatchObject({ changed: [] });
    expect(diff(before, inserted).changes.added.map(({ id }) => id)).toEqual(["1:5", "1:7"]);
    expect(diff(before, redrawn).changes.changed).toEqual([
      expect.objectContaining({ id: "1:2", drawing: true }),
      expect.objectContaining({ id: "1:6", drawing: true }),
    ]);
  });

  it("compares two plugin versions' reads of a drawing over the fields both hold", () => {
    const before = model(column("1:1", "Page", [text("1:9", "Hi"), icon("1:2")]));
    const newer = model(column("1:1", "Page", [text("1:9", "Hi"), { ...icon("1:2"), strokeCap: "ROUND" }]));

    expect(diff(before, newer, false).changes.changed).toEqual([]);
    expect(diff(before, newer, true).changes.changed).toHaveLength(1);
  });
});
