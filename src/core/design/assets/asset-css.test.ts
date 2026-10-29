import { describe, expect, it } from "vitest";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { AssetCss } from "@/core/design/assets/asset-css.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const lengths = new CssLength(new CssVar(new CssSplit()), new NumberFormat(), new TokenNames());
const assets = new AssetCss(lengths, new CssSplit());

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

const parent = layer({ id: "1:1", type: "FRAME", x: 120, y: 1056 });

// C-143, m:1116170e: the file holds how an asset looks; its element only where it sits.
describe("asset CSS", () => {
  it("places a turned icon by its render bounds, without a transform, and keeps its blend mode", () => {
    const arrow = layer({
      id: "1:2",
      type: "VECTOR",
      bounds: { x: 791, y: 1314, width: 78, height: 40 },
      renderBounds: { x: 789.64, y: 1313, width: 80.36, height: 42 },
    });
    const css = [
      ["position", "absolute"],
      ["left", "671px"],
      ["top", "258px"],
      ["width", "78px"],
      ["height", "40px"],
      ["transform", "scaleX(-1)"],
      ["opacity", "0.5"],
      ["mix-blend-mode", "luminosity"],
      ["background", "#FFF"],
    ] as const;

    expect(assets.css(arrow, parent, "icon", css)).toEqual([
      ["position", "absolute"],
      ["left", "670px"],
      ["top", "257px"],
      ["width", "80px"],
      ["height", "42px"],
      ["mix-blend-mode", "luminosity"],
    ]);
  });

  it("keeps an image's corners, outline and outside shadows, its box its bounds", () => {
    const photo = layer({
      id: "1:2",
      bounds: { x: 130, y: 1066, width: 40, height: 20 },
      renderBounds: { x: 120, y: 1056, width: 60, height: 40 },
    });
    const css = [
      ["width", "20px"],
      ["height", "40px"],
      ["border-radius", "12px"],
      ["outline", "1px solid #000"],
      ["box-shadow", "inset 0 0 2px #000, 0 4px 8px rgba(0, 0, 0, 0.2)"],
      ["filter", "blur(4px)"],
    ] as const;

    expect(assets.css(photo, parent, "image", css)).toEqual([
      ["width", "40px"],
      ["height", "20px"],
      ["border-radius", "12px"],
      ["outline", "1px solid #000"],
      ["box-shadow", "0 4px 8px rgba(0, 0, 0, 0.2)"],
    ]);
    expect(assets.css(layer({ id: "1:3" }), parent, "image", [["box-shadow", "inset 0 0 2px #000"]])).toEqual([]);
  });
});
