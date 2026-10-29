import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { CssReader } from "@/core/css/css-reader.ts";
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
import { DesignXml } from "@/core/design/design-xml.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { RepeatFold } from "@/core/design/repeats/repeat-fold.ts";
import { ReadCatalogue } from "@/core/design/text/read-catalogue.ts";
import { ReadTokens } from "@/core/design/text/read-tokens.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/**
 * The 0.7.0 design XML as the oracle, attribute by attribute: each item adds the names its groups own, until item 24
 * compares the XML byte for byte. Values are compared for the element ids both reads have.
 */
const OWNED = [
  // Item 15: the layout group.
  "display",
  "flex-direction",
  "flex-wrap",
  "padding",
  "justify-content",
  "align-items",
  "align-content",
  "gap",
  "column-gap",
  "row-gap",
  "grid-template-columns",
  "grid-template-rows",
  // Item 16: the geometry and appearance groups.
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "flex",
  "align-self",
  "transform",
  "opacity",
  "mix-blend-mode",
  "overflow",
  "text-overflow",
  "white-space",
  "border-radius",
  // Item 17: fills, strokes and the line border.
  "background",
  "color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  // Item 18: effects; background now covers gradients and images too.
  "box-shadow",
  "text-shadow",
  "filter",
  "backdrop-filter",
  // Item 19: text; the Text lines are also compared whole, Spans and content included.
  "textStyle",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-align",
  "text-wrap",
  // Item 20: no new names; every bound value is compared as written, var() and all (T-163).
  // Item 21: what a layer is (C-133..C-136, C-154); every `data-*` mode and `$on-*` interaction is compared too.
  "component",
  "variant",
  "props",
  "$exposed",
  "note",
  "$override",
  "$dev",
  "href",
  "$prop",
  "$visibleProp",
  "$swapProp",
  // Item 22: assets (C-142..C-144): each element's tag and file; the element set is compared too.
  "<tag>",
  "src",
];

/** The attributes named per layer rather than once: variable modes and interactions. */
const OWNED_PATTERN = /^(data-|\$on-|\$after-)/;

/** Deliberate or not-yet differences from 0.7.0, each with the decision or item that settles it; never a silent skip. */
// Item 22 settled the Arrow 54:452 rows (an Icon placed by its render bounds) and the image leaves' backgrounds.
const KNOWN: readonly { fixture: string; id: string; attribute: string; why: string }[] = [];

const FIXTURES = ["desktop-top", "pricing", "plans", "customers"] as const;

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
const fonts = new FontShorthand(format);
const tokens = new ReadTokens(paints, lengths, new EffectsGroup(solid, lengths, format, names), names);
const runs = new TextRun(fonts, paints, format, names);
const planner = new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit()));
const design = new DesignXml(
  new LayerTree(
    new DesignBuilder(
      new NodeTag(),
      new ComponentAttributes(new NameValueList()),
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
    ),
    new TextContent(runs),
    new InteractionAttributes(new EasingCss(format)),
    planner,
  ),
  new XmlWriter(new XmlEscape()),
  new RepeatFold(),
);

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

/** Each element's attributes by its id, its tag as `<tag>`: one element per line, as both writers put them. */
function elements(xml: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();

  for (const line of xml.split("\n")) {
    const attributes = new Map(
      [...line.matchAll(/\s([\w$:-]+)="([^"]*)"/g)].map(([, name = "", value = ""]) => [name, value]),
    );
    const id = attributes.get("id");

    if (id !== undefined) {
      found.set(id, attributes.set("<tag>", /<(\w+)/.exec(line)?.[1] ?? ""));
    }
  }

  return found;
}

/** Each Text's (and TextPath's) whole line by its id, trimmed of its indent. */
function textLines(xml: string): Map<string, string> {
  return new Map(
    xml
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^<Text(Path)? /.test(line))
      .map((line) => [/ id="([^"]*)"/.exec(line)?.[1] ?? "", line]),
  );
}

describe("design XML attributes against the 0.7.0 goldens", () => {
  it.each(FIXTURES)("writes orbit-%s's owned attributes as 0.7.0 did", (fixture) => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read(`./fixtures/orbit-${fixture}.json`)));
    const golden = elements(read(`./__golden__/orbit-${fixture}.xml`));
    const ours = elements(design.xml(model));
    const differences: string[] = [];

    for (const [id, expected] of golden) {
      const actual = ours.get(id);

      const named = [...expected.keys(), ...(actual?.keys() ?? [])].filter((name) => OWNED_PATTERN.test(name));

      for (const attribute of actual === undefined ? [] : new Set([...OWNED, ...named])) {
        const want = expected.get(attribute);
        const have = actual?.get(attribute);
        const known = KNOWN.some((row) => row.fixture === fixture && row.id === id && row.attribute === attribute);

        if (want !== have && !known) {
          differences.push(`${id} ${attribute}: 0.7.0 ${want ?? "-"}, now ${have ?? "-"}`);
        }
      }
    }

    expect(differences).toEqual([]);

    // An asset's children are in its file: both reads list the same elements, but for the hidden layers' stubs
    // (D-18: 0.7.0 left hidden layers out).
    const listed = [...ours].filter(([id, attributes]) => golden.has(id) || attributes.get("display") !== "none");

    expect(listed.map(([id]) => id).sort()).toEqual([...golden.keys()].sort());
  });

  // C-1.1, C-120: a Text with its Spans is one line; compared whole, the content and every attribute on it.
  it.each(FIXTURES)("writes orbit-%s's Text lines as 0.7.0 did", (fixture) => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read(`./fixtures/orbit-${fixture}.json`)));
    const golden = textLines(read(`./__golden__/orbit-${fixture}.xml`));
    const ours = textLines(design.xml(model));
    const differences = [...golden]
      .filter(([id, line]) => ours.has(id) && line !== ours.get(id))
      .map(([id, line]) => `0.7.0 ${line}\n  now ${ours.get(id) ?? "-"}`);

    expect(differences).toEqual([]);
    expect(golden.size).toBeGreaterThan(0);
  });

  // T-163, C-123: the JSON block's tokens, text styles (font shorthand, spacing, case) and each family's weights.
  it("lists the tokens, text styles and fonts of the Plans row as 0.7.0 did", () => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read("./fixtures/orbit-plans.json")));

    const { assets, ...catalogue } = new ReadCatalogue(fonts, names, tokens, planner).read(model);

    expect(assets).toHaveLength(9);
    expect(catalogue).toEqual({
      tokens: {
        "--Shadow-Card": "0 12px 32px -8px rgba(20, 22, 31, 0.12)",
        "--color-accent": "#FF6B3D",
        "--color-brand": "#3B2FD9",
        "--color-ink": "#14161F",
        "--color-ink-muted": "#4A4F5E",
        "--color-line": "#E1E5EE",
        "--color-on-brand": "#FFF",
        "--color-surface": "#FFF",
        "--radius-lg": "24px",
        "--radius-md": "12px",
        "--radius-pill": "999px",
        "--space-12": "12px",
        "--space-24": "24px",
        "--space-32": "32px",
        "--space-4": "4px",
        "--space-8": "8px",
      },
      textStyles: {
        Body: "400 16px/24px 'Inter'",
        "Body Small": "400 14px/20px 'Inter'",
        Button: "600 15px/20px 'Inter'",
        "Heading/H3": "500 24px/30px 'Space Grotesk'; letter-spacing: -0.01em",
        Label: "600 12px/16px 'Inter'; letter-spacing: 0.06em; text-transform: uppercase",
        Price: "700 48px/52px 'Space Grotesk'; letter-spacing: -0.02em",
      },
      fonts: { "Space Grotesk": ["500", "700"], Inter: ["400", "600"] },
    });
  });

  // C-144: the Customers frame's files, named from the layers and their variants, a clash suffixed.
  it("lists the assets of the Customers frame as 0.7.0 did", () => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read("./fixtures/orbit-customers.json")));

    expect(new ReadCatalogue(fonts, names, tokens, planner).read(model).assets).toEqual([
      { node: "54:437", kind: "icon", format: "SVG", src: "assets/logo-nova.svg" },
      { node: "54:441", kind: "icon", format: "SVG", src: "assets/logo-lumen.svg" },
      { node: "54:445", kind: "icon", format: "SVG", src: "assets/logo-nova-2.svg" },
      { node: "54:452", kind: "icon", format: "SVG", src: "assets/arrow.svg" },
      { node: "54:454", kind: "image", format: "PNG", src: "assets/product-shot.png", scale: 2 },
      { node: "54:456", kind: "image", format: "PNG", src: "assets/avatar.png" },
    ]);
  });

  // C-1.7, B-058: a Display P3 file's colours are P3 values: its read holds no sRGB hex; an sRGB file reads as before.
  it("writes a Display P3 file's colours as color(display-p3 …) and an sRGB file's as before", () => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read("./fixtures/orbit-customers.json")));
    const p3 = design.xml({ ...model, colorProfile: "DISPLAY_P3" });

    expect(p3).toContain("color(display-p3 ");
    expect(p3).not.toMatch(/="[^"]*#[0-9A-Fa-f]{3,8}\b/);
    expect(design.xml({ ...model, colorProfile: "SRGB" })).toBe(design.xml(model));
  });
});
