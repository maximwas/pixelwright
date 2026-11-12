import { describe, expect, it } from "vitest";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { AssetClassifier } from "@/core/design/assets/asset-classifier.ts";
import { AssetCss } from "@/core/design/assets/asset-css.ts";
import { AssetPlanner } from "@/core/design/assets/asset-planner.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const lengths = new CssLength(new CssVar(new CssSplit()), new NumberFormat(), new TokenNames());
const planner = new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit()));

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

/** A text, which keeps a frame a layout. */
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

/** A read of a frame holding the layers. */
function read(children: ReadLayer[]): ReadModel {
  const root = layer({ id: "0:1", type: "FRAME", children: [copy("0:2"), ...children] });

  return { model: 1, profile: "design", root, styles: {}, variables: {} };
}

const image = (hash: string) => [{ type: "IMAGE", imageHash: hash }];

// C-144, B-046: one file per asset, its name taken once per full file name, in the order the XML lists the layers.
describe("asset planner", () => {
  it("names files after the layer and its variant values, suffixing a taken full file name", () => {
    const logo = (id: string, fields: Partial<ReadLayer> = {}) =>
      layer({ id, type: "VECTOR", name: "Logo", ...fields });
    const nova = logo("1:5", {
      type: "INSTANCE",
      instance: {
        componentId: "9:1",
        componentName: "Brand=Nova",
        properties: { Brand: { type: "VARIANT", value: "Nova" } },
      },
      children: [layer({ id: "I1:5;1", type: "VECTOR", name: "Mark" })],
    });
    const photo = logo("1:3", {
      type: "RECTANGLE",
      fills: image("h1"),
      exportSettings: [{ format: "PNG", constraint: { type: "SCALE", value: 2 } }],
    });
    const plan = planner.plan(read([logo("1:1"), logo("1:2"), photo, logo("1:4"), nova]));

    expect(plan.assets()).toEqual([
      { node: "1:1", kind: "icon", format: "SVG", src: "assets/logo.svg" },
      { node: "1:2", kind: "icon", format: "SVG", src: "assets/logo-2.svg" },
      { node: "1:3", kind: "image", format: "PNG", src: "assets/logo.png", scale: 2 },
      { node: "1:4", kind: "icon", format: "SVG", src: "assets/logo-3.svg" },
      { node: "1:5", kind: "icon", format: "SVG", src: "assets/logo-nova.svg" },
    ]);
    expect(plan.file("I1:5;1")).toBeUndefined();
  });

  it("plans an image behind content once per image hash, named after the first layer", () => {
    const behind = (
      id: string,
      name: string,
      hash: string,
    ) =>
      layer({ id, type: "FRAME", name, fills: image(hash), children: [copy(`${id}.1`)] });
    const plan = planner.plan(
      read([behind("1:1", "Hero", "h1"), behind("1:2", "Card", "h1"), behind("1:3", "Card", "h2")]),
    );

    expect(plan.assets()).toEqual([
      { node: "1:1", kind: "image", format: "PNG", src: "assets/hero-background.png", imageHash: "h1" },
      { node: "1:3", kind: "image", format: "PNG", src: "assets/card-background.png", imageHash: "h2" },
    ]);
  });

  it("lists a video fill as a video with no file, and plans no Image for it (B-001, D-23)", () => {
    const plan = planner.plan(read([layer({ id: "1:1", name: "Clip", fills: [{ type: "VIDEO" }] })]));

    expect(plan.assets()).toEqual([{ node: "1:1", kind: "video" }]);
    expect(plan.file("1:1")).toBeUndefined();
  });

  it("leaves hidden layers and slices out", () => {
    const hidden = layer({ id: "1:1", type: "VECTOR", visible: false });
    const slice = layer({ id: "1:2", type: "SLICE", exportSettings: [{ format: "PNG" }] });

    expect(planner.plan(read([hidden, slice])).assets()).toEqual([]);
  });
});
