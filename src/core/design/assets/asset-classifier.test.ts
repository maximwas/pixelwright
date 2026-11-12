import { describe, expect, it } from "vitest";
import { AssetClassifier } from "@/core/design/assets/asset-classifier.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const classifier = new AssetClassifier();

/** A layer with the fields every layer has, and those the case sets. */
function layer(fields: Partial<ReadLayer> & Pick<ReadLayer, "id">): ReadLayer {
  return {
    name: fields.id,
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}

/** A text, which keeps a container a layout. */
function copy(id: string): ReadLayer {
  return layer({
    id,
    type: "TEXT",
    text: {
      characters: "Copy",
      textAutoResize: "NONE",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    },
  });
}

const PNG_2X = [{ format: "PNG", constraint: { type: "SCALE", value: 2 } }];
const ICON = { kind: "icon", format: "SVG" };
const IMAGE = { kind: "image", format: "PNG" };

// C-142, m:1116170e: what is exported whole, and as what.
describe("asset classes", () => {
  const root = layer({ id: "0:1", type: "FRAME" });

  it("takes the designer's export settings, except a PDF, a layer with text or the read's root", () => {
    const shapes = [layer({ id: "1:3" })];
    const exported = (
      type: string,
      settings: NonNullable<ReadLayer["exportSettings"]>,
      children = shapes,
    ) =>
      layer({ id: "1:2", type, exportSettings: settings, children });
    const root2x = exported("FRAME", PNG_2X);

    expect(classifier.classify(exported("FRAME", [{ format: "SVG" }]), root)).toEqual(ICON);
    expect(classifier.classify(exported("GROUP", PNG_2X), root)).toEqual({ ...IMAGE, scale: 2 });
    expect(classifier.classify(exported("FRAME", [{ format: "PDF" }]), root)).toBeNull();
    expect(classifier.classify(exported("FRAME", PNG_2X, [copy("1:3")]), root)).toBeNull();
    expect(classifier.classify(root2x, root2x)).toBeNull();
  });

  it("makes a container whose bottom child is a mask one image, unless it is the root or a frame with text", () => {
    const masked = (type: string, above: ReadLayer) =>
      layer({ id: "1:2", type, children: [layer({ id: "1:3", type: "ELLIPSE", isMask: true }), above] });
    const group = masked("GROUP", layer({ id: "1:4" }));

    expect(classifier.classify(group, root)).toEqual(IMAGE);
    expect(classifier.classify(masked("GROUP", copy("1:4")), root)).toEqual(IMAGE);
    expect(classifier.classify(masked("FRAME", copy("1:4")), root)).toBeNull();
    expect(classifier.classify(group, group)).toBeNull();

    // A mask among other layers clips only those above it: the frame stays a layout.
    const among = layer({ id: "1:2", type: "FRAME", children: [copy("1:5"), layer({ id: "1:3", isMask: true })] });

    expect(classifier.classify(among, root)).toBeNull();
  });

  it("renders a leaf with an image fill or what CSS cannot draw, and marks a video fill as video", () => {
    const leaf = (fields: Partial<ReadLayer>) => classifier.classify(layer({ id: "1:2", ...fields }), root);

    expect(leaf({ fills: [{ type: "IMAGE", imageHash: "h1" }] })).toEqual(IMAGE);
    expect(leaf({ fills: [{ type: "IMAGE", visible: false }] })).toBeNull();
    expect(leaf({ effects: [{ type: "NOISE" }] })).toEqual(IMAGE);
    expect(leaf({ fills: [{ type: "PATTERN" }] })).toEqual(IMAGE);
    // B-001, D-23: a video is no PNG: the Plugin API cannot export it.
    expect(leaf({ fills: [{ type: "SOLID" }, { type: "VIDEO" }] })).toEqual({ kind: "video" });
  });

  it("draws vectors, transform groups and a container of shapes with a real vector as one icon, a logo included", () => {
    const vector = (id: string) => layer({ id, type: "VECTOR" });
    const mark = layer({ id: "1:3", type: "GROUP", children: [vector("1:4"), layer({ id: "1:5", type: "ELLIPSE" })] });
    // The trap: a frame of shapes and one vector is one icon even as the read's root.
    const drawing = layer({ id: "1:2", type: "FRAME", children: [layer({ id: "1:3" }), vector("1:4")] });

    expect(classifier.classify(vector("1:2"), root)).toEqual(ICON);
    expect(classifier.classify(layer({ id: "1:2", type: "TRANSFORM_GROUP", children: [vector("1:3")] }), root)).toEqual(
      ICON,
    );
    expect(classifier.classify(layer({ id: "1:2", type: "INSTANCE", children: [mark] }), root)).toEqual(ICON);
    expect(classifier.classify(drawing, drawing)).toEqual(ICON);
  });

  it("keeps a container a layout when it holds text, no real vector, auto layout, an image or a cut branch", () => {
    const vector = layer({ id: "1:3", type: "VECTOR" });
    const container = (fields: Partial<ReadLayer>) =>
      classifier.classify(layer({ id: "1:2", type: "GROUP", ...fields }), root);

    expect(container({ type: "INSTANCE", children: [vector, copy("1:4")] })).toBeNull();
    expect(container({ type: "FRAME", children: [layer({ id: "1:3" })] })).toBeNull();
    expect(container({ type: "FRAME", layoutMode: "HORIZONTAL", children: [vector] })).toBeNull();
    expect(container({ children: [vector, layer({ id: "1:4", fills: [{ type: "IMAGE" }] })] })).toBeNull();
    expect(container({ children: [vector, layer({ id: "1:4", type: "GROUP", childCount: 2 })] })).toBeNull();
  });
});
