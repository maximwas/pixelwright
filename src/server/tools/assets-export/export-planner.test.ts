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
import { ExportPlanner } from "@/server/tools/assets-export/export-planner.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const lengths = new CssLength(new CssVar(new CssSplit()), new NumberFormat(), new TokenNames());
const classifier = new AssetClassifier();
const planner = new ExportPlanner(
  new AssetPlanner(classifier, new Slug(), new AssetCss(lengths, new CssSplit())),
  classifier,
  new Slug(),
);
const ORIGINAL = { original: true } as const;

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

const read = (root: ReadLayer): ReadModel => ({ model: 1, profile: "design", root, styles: {}, variables: {} });

const image = (imageHash: string, visible = true) => ({ type: "IMAGE", imageHash, visible, scaleMode: "FILL" });

describe("assets_export plan", () => {
  it("lists each layer asked for once, by its own image, a frame and the image inside it alike (B-003)", () => {
    const inner = layer({ id: "1:2", name: "Photo", fills: [image("b".repeat(40))] });
    const frame = layer({ id: "1:1", name: "Card", type: "FRAME", fills: [image("a".repeat(40))], children: [inner] });
    const { assets, errors } = planner.layers([read(frame), read(inner), read(inner)], ORIGINAL);

    expect(errors).toEqual([]);
    expect(assets.map(({ node, imageHash, src }) => [node, imageHash, src])).toEqual([
      ["1:1", "a".repeat(40), "card.png"],
      ["1:2", "b".repeat(40), "photo.png"],
    ]);
  });

  it("takes the topmost visible image fill as the original and notes the others (B-004)", () => {
    const stacked = layer({
      id: "1:3",
      fills: [image("a".repeat(40)), image("b".repeat(40)), image("c".repeat(40), false)],
    });
    const { assets, notes } = planner.layers([read(stacked)], ORIGINAL);

    expect(assets.map(({ imageHash }) => imageHash)).toEqual(["b".repeat(40)]);
    expect(notes).toEqual([expect.stringMatching(/^1:3 has 2 other image fills/)]);
  });

  it("marks a video fill as a video no export can write, and says to ask the designer for the file (B-001)", () => {
    const clip = layer({ id: "1:4", fills: [{ type: "VIDEO", videoHash: "d".repeat(40), scaleMode: "FILL" }] });
    const { assets, errors } = planner.layers([read(clip)], ORIGINAL);

    expect(assets).toEqual([]);
    expect(errors).toEqual([
      {
        node: "1:4",
        kind: "video",
        message: expect.stringContaining(
          "video fills cannot be exported through the Plugin API: ask the designer for the file",
        ),
      },
    ]);
  });

  it("takes an image fill beside a video fill as the original and notes the video it cannot write (B-001)", () => {
    const both = layer({
      id: "1:5",
      fills: [image("e".repeat(40)), { type: "VIDEO", videoHash: "f".repeat(40), scaleMode: "FILL" }],
    });
    const { assets, errors, notes } = planner.layers([read(both)], ORIGINAL);

    expect(assets.map(({ imageHash }) => imageHash)).toEqual(["e".repeat(40)]);
    expect(errors).toEqual([]);
    expect(notes).toEqual([expect.stringContaining("1:5 is filled with a video")]);
  });

  it("renders a line, which has no width to size by, at the density asked instead of dividing by zero", () => {
    const line = layer({ id: "1:6", type: "LINE", width: 0, height: 1 });
    const { assets, errors } = planner.layers([read(line)], { original: false, width: 300 });

    expect(errors).toEqual([]);
    expect(assets).toEqual([expect.objectContaining({ node: "1:6", format: "PNG" })]);
    expect(assets[0]?.scale).toBeUndefined();
  });
});
