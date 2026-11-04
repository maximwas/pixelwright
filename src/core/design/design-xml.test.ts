import { describe, expect, it } from "vitest";
import { CssReader } from "@/core/css/css-reader.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
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
import { DesignXml } from "@/core/design/design-xml.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { RepeatFold } from "@/core/design/repeats/repeat-fold.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format, new TokenNames());
const solid = new SolidPaint(new TokenNames());
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  new TokenNames(),
);
const design = new DesignXml(
  new LayerTree(
    new DesignBuilder(
      new NodeTag(),
      new ComponentAttributes(new NameValueList(), new TokenNames()),
      new CssReader(new GroupRegistry([new LayoutGroup(lengths, format), new FillsGroup(paints)])),
      new TextPathData(),
    ),
    new TextContent(new TextRun(new FontShorthand(format, new FontWeight()), paints, format, new TokenNames())),
    new InteractionAttributes(new EasingCss(format)),
    new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit())),
  ),
  new XmlWriter(new XmlEscape()),
  new RepeatFold(),
);

/** A layer with the fields every layer has, and those the case sets. */
function layer(fields: Partial<ReadLayer> & Pick<ReadLayer, "id" | "type" | "name">): ReadLayer {
  return { visible: true, x: 0, y: 0, width: 10, height: 10, childCount: fields.children?.length ?? 0, ...fields };
}

/** A text layer with one run of the characters. */
function text(
  id: string,
  name: string,
  characters: string,
): ReadLayer {
  return layer({
    id,
    type: "TEXT",
    name,
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    },
  });
}

function model(root: ReadLayer, header: Partial<ReadModel> = {}): ReadModel {
  return { model: 1, profile: "design", root, styles: {}, variables: {}, ...header };
}

describe("DesignXml", () => {
  // C-1.3: id, name, component, variant, props, notes and status, href, mask, then the read-only $ attributes.
  it("writes a layer's metadata, then its read-only attributes, in their order", () => {
    const root = layer({
      id: "1:1",
      type: "INSTANCE",
      name: "Buy button",
      instance: {
        componentId: "9:1",
        componentName: "State=Hover",
        setName: "Button",
        exposed: true,
        properties: {
          State: { type: "VARIANT", value: "Hover" },
          "Label#1:2": { type: "TEXT", value: "Buy, now" },
          "Icon#3:4": { type: "BOOLEAN", value: true },
        },
      },
      annotations: [{ label: "Opens | the cart", category: "Behaviour" }],
      overrides: ["strokes"],
      href: "https://orbit.test/cart",
      modes: [{ collection: "Brand", mode: "Ocean Blue" }],
      reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] }],
      componentPropertyReferences: { visible: "Shown#5:6" },
      gridStyleId: "S:grid",
      childCount: 3,
      children: [layer({ id: "1:2", type: "RECTANGLE", name: "Fill", isMask: true })],
    });
    const styles = { "S:grid": { name: "Grid/12", type: "GRID", remote: false } };

    expect(design.xml(model(root, { devStatus: "ready", styles }))).toBe(
      [
        '<Instance id="1:1" name="Buy button" component="Button" variant="State=Hover" props="Label=Buy\\, now, Icon=true"' +
          ' $exposed="true" note="Behaviour: Opens \\| the cart" $override="border" $dev="ready for dev"' +
          ' href="https://orbit.test/cart" data-brand="ocean-blue" $visibleProp="Shown" $grid-style="Grid/12"' +
          ' $on-click="back" $children="3">',
        '  <Rectangle id="1:2" name="Fill" mask="alpha"/>',
        "</Instance>",
      ].join("\n"),
    );
  });

  it("writes a Text's name only when it differs from its characters, and its characters between its tags", () => {
    const root = layer({
      id: "2:1",
      type: "FRAME",
      name: "Card",
      children: [text("2:2", "Buy", "Buy"), text("2:3", "Price", "$9\na month")],
    });

    expect(design.xml(model(root))).toBe(
      [
        '<Frame id="2:1" name="Card">',
        '  <Text id="2:2">Buy</Text>',
        '  <Text id="2:3" name="Price">$9&#10;a month</Text>',
        "</Frame>",
      ].join("\n"),
    );
  });

  // C-1.3: the CSS goes after the metadata in CSS_ORDER, its read-only notes in $css before the other $ attributes.
  it("writes a layer's CSS between its metadata and its read-only attributes, the notes as $css", () => {
    const root = layer({
      id: "4:1",
      type: "FRAME",
      name: "Avatars",
      layoutMode: "VERTICAL",
      itemSpacing: -8,
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
      componentPropertyReferences: { visible: "Shown#1:2" },
      children: [layer({ id: "4:2", type: "ELLIPSE", name: "A" }), layer({ id: "4:3", type: "ELLIPSE", name: "B" })],
    });

    expect(design.xml(model(root)).split("\n")[0]).toBe(
      '<Frame id="4:1" name="Avatars" display="flex" flex-direction="column" padding="8px 16px"' +
        ' $visibleProp="Shown" $css="gap: -8px (the children overlap)">',
    );
  });

  // D-18, C-141: a hidden layer shows as a stub, so the property that shows it is seen; a slice draws nothing.
  it("writes a hidden layer as a stub with the property that shows it and no children, and leaves a slice out", () => {
    const badge = layer({
      id: "3:2",
      type: "INSTANCE",
      name: "Badge",
      visible: false,
      componentPropertyReferences: { visible: "Badge#7:8", characters: "Label#7:9" },
      children: [layer({ id: "3:3", type: "TEXT", name: "Label" })],
    });
    const root = layer({
      id: "3:1",
      type: "FRAME",
      name: "Plan",
      children: [badge, layer({ id: "3:4", type: "SLICE", name: "Export" })],
    });

    expect(design.xml(model(root))).toBe(
      [
        '<Frame id="3:1" name="Plan">',
        '  <Instance id="3:2" name="Badge" display="none" $visibleProp="Badge"/>',
        "</Frame>",
      ].join("\n"),
    );
  });

  // T-140 (read): a text on a path says the path it runs along, to two decimals, and where its text starts.
  it("writes a TextPath's path as d and its start after its name", () => {
    const xml = design.xml(
      model({
        ...text("1:2", "Label on arc", ""),
        type: "TEXT_PATH",
        textPath: {
          vectorPaths: [
            { windingRule: "NONE", data: "M 0 50 C 55.228 -16.667 144.772 -16.667 200.0004 50" },
            { windingRule: "NONE", data: "M 0 60 L 200 60 Z" },
          ],
          textPathStartData: { segment: 0, position: 0.25 },
        },
      }),
    );

    expect(xml).toBe(
      '<TextPath id="1:2" name="Label on arc" d="M 0 50 C 55.23 -16.67 144.77 -16.67 200 50 M 0 60 L 200 60 Z" start="0 0.25"></TextPath>',
    );
  });

  // C-1.5 (m:48b67951): the properties a designer pinned in Dev Mode, in CSS words, once each, right after the notes.
  it("writes the properties pinned in annotations in CSS words, once each, after the notes", () => {
    const root = layer({
      id: "1:1",
      type: "FRAME",
      name: "Box",
      children: [
        layer({
          id: "1:2",
          type: "FRAME",
          name: "Card",
          annotations: [
            { label: "API", pins: ["width", "itemSpacing"] },
            { pins: ["fills", "width", "gridColumnSpan", "somethingNew"] },
          ],
        }),
        { ...text("1:3", "Price", "9"), annotations: [{ pins: ["fills", "textStyleId"] }] },
      ],
    });
    const lines = design.xml(model(root)).split("\n");
    const line = (id: string) => lines.find((each) => each.includes(`id="${id}"`)) ?? "";

    expect(line("1:2")).toContain('note="API" $pins="width, gap, background, grid-column, somethingNew"');
    expect(line("1:3")).toContain('$pins="color, text style"');
    expect(line("1:3")).not.toContain("note=");
  });

  // A slice is no element: a limit counts the elements shown, and $children says only that a child that shows is left out.
  it("lists children up to a limit of elements shown, with $children only when a shown child is left out", () => {
    const shapes = ["1:3", "1:4", "1:5"].map((id) => layer({ id, type: "RECTANGLE", name: `Shape ${id}` }));
    const root = layer({
      id: "1:1",
      type: "FRAME",
      name: "Row",
      children: [layer({ id: "1:2", type: "SLICE", name: "Export" }), ...shapes],
    });
    const first = (limit: number) => design.read(model(root), { limits: new Map([["1:1", limit]]) }).xml.split("\n")[0];

    expect(first(3)).not.toContain("$children");
    expect(first(2)).toContain('$children="4"');
  });
});

// C-142, C-144, B-001: an asset is an Icon or Image with its file and no children; a video stays its own layer.
describe("DesignXml assets", () => {
  it("writes an icon and an image with their src and without children, and a video fill as its own layer", () => {
    const mask = layer({ id: "1:6", type: "ELLIPSE", name: "Mask", isMask: true });
    const root = layer({
      id: "1:1",
      type: "FRAME",
      name: "Row",
      children: [
        text("1:2", "Copy", "Copy"),
        layer({
          id: "1:3",
          type: "INSTANCE",
          name: "Logo",
          children: [layer({ id: "1:4", type: "VECTOR", name: "Mark" })],
        }),
        layer({
          id: "1:5",
          type: "GROUP",
          name: "Avatar",
          children: [mask, layer({ id: "1:7", type: "RECTANGLE", name: "Photo" })],
        }),
        layer({ id: "1:8", type: "RECTANGLE", name: "Clip", fills: [{ type: "VIDEO" }] }),
      ],
    });

    expect(design.xml(model(root)).split("\n").slice(2)).toEqual([
      '  <Icon id="1:3" name="Logo" src="assets/logo.svg"/>',
      '  <Image id="1:5" name="Avatar" src="assets/avatar.png"/>',
      '  <Rectangle id="1:8" name="Clip" $css="background: a video fill (the Plugin API exports no file of it)"/>',
      "</Frame>",
    ]);
  });
});
