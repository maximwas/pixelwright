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
import { VariantDiff } from "@/core/diff/variant-diff.ts";
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

const variants = new VariantDiff(new DesignDiff(tree, new Fingerprint()), new NameValueList());

/** A variant at x, y, its fill a grey of this level. */
function variant(
  id: string,
  name: string,
  place: readonly [x: number, y: number],
  level: number,
): ReadLayer {
  const [x, y] = place;

  return {
    id,
    name,
    type: "COMPONENT",
    visible: true,
    x,
    y,
    width: 120,
    height: 40,
    childCount: 0,
    layoutMode: "HORIZONTAL",
    fills: [{ type: "SOLID", visible: true, color: { r: level, g: level, b: level } }],
  };
}

function set(children: ReadLayer[]): ReadModel {
  const root = {
    id: "5:1",
    name: "Button",
    type: "COMPONENT_SET",
    visible: true,
    x: 0,
    y: 0,
    width: 6000,
    height: 200,
    childCount: children.length,
    children,
  };

  return { model: 1, profile: "design", root, styles: {}, variables: {} };
}

describe("VariantDiff", () => {
  // T-086, K-053: the default is the top-left variant; a state value names its pseudo-class.
  it("compares each variant with the default, the top-left one, and names the pseudo-class a state suggests", () => {
    const view = variants.view(
      set([
        variant("5:3", "State=Hover", [140, 0], 0.3),
        variant("5:2", "State=Default", [0, 0], 0),
        variant("5:4", "State=Disabled", [280, 0], 0),
      ]),
    );

    expect(view.default).toEqual({ id: "5:2", name: "State=Default" });
    expect(view.properties).toEqual({ State: ["Hover", "Default", "Disabled"] });
    expect(view.variants).toEqual([
      expect.objectContaining({
        id: "5:3",
        props: { State: "Hover" },
        pseudo: ":hover",
        changed: [expect.objectContaining({ path: "(root)", attributes: { background: ["#000", "#4D4D4D"] } })],
      }),
      expect.objectContaining({ id: "5:4", pseudo: ":disabled", same: true }),
    ]);
  });

  it("compares a state with the variant it differs from by that state alone", () => {
    const view = variants.view(
      set([
        variant("6:2", "Size=Small, State=Default", [0, 0], 0),
        variant("6:3", "Size=Small, State=Hover", [140, 0], 0.3),
        { ...variant("6:4", "Size=Large, State=Default", [0, 100], 0), width: 200 },
        { ...variant("6:5", "Size=Large, State=Hover", [140, 100], 0.3), width: 200 },
      ]),
    );

    expect(view.variants.find(({ id }) => id === "6:5")).toMatchObject({
      pseudo: ":hover",
      against: { id: "6:4", name: "Size=Large, State=Default" },
      changed: [{ path: "(root)", attributes: { background: ["#000", "#4D4D4D"] } }],
    });
  });

  it("lists at most 50 variants, and says how many more", () => {
    const view = variants.view(
      set(
        Array.from({ length: 61 }, (_value, index) => variant(`7:${index + 2}`, `Name=i${index}`, [index * 50, 0], 0)),
      ),
    );

    expect(view.variants).toHaveLength(50);
    expect(view.more).toBe(10);
  });
});
