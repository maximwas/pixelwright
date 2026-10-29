import { describe, expect, it } from "vitest";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const design = new DesignXml(
  new LayerTree(new DesignBuilder(new NodeTag(), new NameValueList())),
  new XmlWriter(new XmlEscape()),
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
      href: "https://orbit.test/cart",
      componentPropertyReferences: { visible: "Shown#5:6" },
      gridStyleId: "S:grid",
      childCount: 3,
      children: [layer({ id: "1:2", type: "RECTANGLE", name: "Fill", isMask: true })],
    });
    const styles = { "S:grid": { name: "Grid/12", type: "GRID", remote: false } };

    expect(design.xml(model(root, { devStatus: "ready", styles }))).toBe(
      [
        '<Instance id="1:1" name="Buy button" component="Button" variant="State=Hover" props="Label=Buy\\, now, Icon=true"' +
          ' $exposed="true" note="Behaviour: Opens \\| the cart" $dev="ready for dev" href="https://orbit.test/cart"' +
          ' $visibleProp="Shown" $grid-style="Grid/12" $children="3">',
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
});
