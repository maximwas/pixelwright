import { readFileSync } from "node:fs";
import * as zod from "zod/mini";
import { CssReader } from "@/core/css/css-reader.ts";
import { AutoLineHeights } from "@/core/css/fonts/auto-line-heights.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { AppearanceGroup } from "@/core/css/groups/appearance/appearance-group.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { GeometryGroup } from "@/core/css/groups/geometry/geometry-group.ts";
import { Placement } from "@/core/css/groups/geometry/placement.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
import { StrokesGroup } from "@/core/css/groups/paint/strokes-group.ts";
import { TextGroup } from "@/core/css/groups/text/text-group.ts";
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
import { DesignReader } from "@/core/design/design-reader.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { DesignFit } from "@/core/design/fit/design-fit.ts";
import { DesignHints } from "@/core/design/hints/design-hints.ts";
import { InferredHints } from "@/core/design/hints/inferred-hints.ts";
import { LayerHints } from "@/core/design/hints/layer-hints.ts";
import { LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { AlikeStructures } from "@/core/design/hints/structure/alike-structures.ts";
import { BakedPaints } from "@/core/design/hints/structure/baked-paints.ts";
import { LayerShape } from "@/core/design/hints/structure/layer-shape.ts";
import { SharedLayers } from "@/core/design/hints/structure/shared-layers.ts";
import { StructureHints } from "@/core/design/hints/structure/structure-hints.ts";
import { TokenHints } from "@/core/design/hints/token-hints.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { ReadJson } from "@/core/design/read-json.ts";
import { ReadTokens } from "@/core/design/read-tokens.ts";
import { RepeatFold } from "@/core/design/repeats/repeat-fold.ts";
import { ReadCatalogue } from "@/core/design/text/read-catalogue.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { Measurements } from "@/core/inspect/measurements.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/** design_read's core classes, built by hand as the server root binds them. */
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
const runs = new TextRun(new FontShorthand(format), paints, format, names);
const classifier = new AssetClassifier();

export const planner = new AssetPlanner(classifier, new Slug(), new AssetCss(lengths, new CssSplit()));

const components = new ComponentAttributes(new NameValueList());
const shape = new LayerShape();

/** design_read's element builder: a layer's tag and attributes. */
export const builder = new DesignBuilder(
  new NodeTag(),
  components,
  new CssReader(
    new GroupRegistry([
      new LayoutGroup(lengths, format),
      new GeometryGroup(new Placement(lengths, format), lengths, format),
      new AppearanceGroup(lengths, format),
      new FillsGroup(paints),
      new StrokesGroup(paints, format),
      new EffectsGroup(solid, lengths, format, names),
      new TextGroup(runs, lengths),
    ]),
  ),
  new TextPathData(),
);

export const design = new DesignXml(
  new LayerTree(builder, new TextContent(runs), new InteractionAttributes(new EasingCss(format)), planner),
  new XmlWriter(new XmlEscape()),
  new RepeatFold(),
);

export const fit = new DesignFit(design);

export const catalogue = new ReadCatalogue(
  new FontShorthand(format),
  names,
  new ReadTokens(paints, lengths, new EffectsGroup(solid, lengths, format, names), names),
  planner,
);

const hints = new DesignHints(
  new LayerHints(
    components,
    new LayoutGuess(format),
    format,
    new StructureHints(format, new AlikeStructures(shape), new SharedLayers(shape), new BakedPaints(format)),
  ),
  new TokenHints(names, solid),
  new InferredHints(names, format),
  classifier,
);

export const reader = new DesignReader(design, fit, new ReadJson(catalogue, hints, new Measurements(format)), planner);

/** design_read's `autoLineHeight: "px"` over a read model. */
export const lines = new AutoLineHeights(format);

/** An Orbit fixture as its read model. */
export function fixture(name: string): ReadModel {
  return zod.parse(
    ReadModelSchema,
    JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")),
  );
}
