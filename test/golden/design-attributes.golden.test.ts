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
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { ReadCatalogue } from "@/core/design/text/read-catalogue.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

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
];

/** Deliberate or not-yet differences from 0.7.0, each with the decision or item that settles it; never a silent skip. */
const KNOWN: readonly { fixture: string; id: string; attribute: string; why: string }[] = [
  // The mirrored Arrow is an Icon in 0.7.0: an icon is exported turned, placed by its render bounds without a
  // transform (m:1116170e). Assets are not told apart yet; the asset item settles these rows.
  ...["pricing", "customers"].flatMap((fixture) =>
    ["left", "top", "width", "height", "transform"].map((attribute) => ({
      fixture,
      id: "54:452",
      attribute,
      why: "asset placement by render bounds, no transform (m:1116170e; the asset item)",
    })),
  ),
  // A leaf with an image fill is an Image asset in 0.7.0 (src, no background; m:1116170e): the asset item settles it.
  ...[
    ["pricing", "54:317"],
    ["pricing", "54:454"],
    ["customers", "54:454"],
  ].map(([fixture = "", id = ""]) => ({
    fixture,
    id,
    attribute: "background",
    why: "image leaf is an Image asset with src (m:1116170e; the asset item)",
  })),
];

const FIXTURES = ["desktop-top", "pricing", "plans", "customers"] as const;

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format);
const solid = new SolidPaint();
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
);
const fonts = new FontShorthand(format);
const runs = new TextRun(fonts, paints, format);
const design = new DesignXml(
  new LayerTree(
    new DesignBuilder(
      new NodeTag(),
      new NameValueList(),
      new CssReader(
        new GroupRegistry([
          new LayoutGroup(lengths, format),
          new GeometryGroup(new Placement(lengths, format), lengths, format),
          new AppearanceGroup(lengths, format),
          new FillsGroup(paints),
          new StrokesGroup(paints, format),
          new EffectsGroup(solid, lengths, format),
          new TextGroup(runs, lengths),
        ]),
      ),
      new TextPathData(),
    ),
    new TextContent(runs),
  ),
  new XmlWriter(new XmlEscape()),
);

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

/** Each element's attributes by its id: one element per line, as both writers put them. */
function elements(xml: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();

  for (const line of xml.split("\n")) {
    const attributes = new Map(
      [...line.matchAll(/\s([\w$:-]+)="([^"]*)"/g)].map(([, name = "", value = ""]) => [name, value]),
    );
    const id = attributes.get("id");

    if (id !== undefined) {
      found.set(id, attributes);
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

/**
 * The px a golden's var() stands for: 0.7.0 wrote bound variables as tokens, which come in item 20; until then the
 * values are compared through the fixture's variable values (Orbit names its tokens after them: space/64 = --space-64).
 */
function withoutTokens(value: string, model: ReadModel): string {
  const pixels = new Map(
    Object.values(model.variables).flatMap((variable) =>
      typeof variable.value === "number" ? [[`--${variable.name.replaceAll("/", "-")}`, variable.value]] : [],
    ),
  );

  return value.replace(/var\((--[^)]+)\)/g, (token, name: string) => {
    const pixel = pixels.get(name);

    return pixel === undefined ? token : pixel === 0 ? "0" : `${pixel}px`;
  });
}

describe("design XML attributes against the 0.7.0 goldens", () => {
  it.each(FIXTURES)("writes orbit-%s's owned attributes as 0.7.0 did", (fixture) => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read(`./fixtures/orbit-${fixture}.json`)));
    const golden = elements(read(`./__golden__/orbit-${fixture}.xml`));
    const ours = elements(design.xml(model));
    const differences: string[] = [];

    for (const [id, expected] of golden) {
      const actual = ours.get(id);

      for (const attribute of actual === undefined ? [] : OWNED) {
        const want = expected.get(attribute);
        const have = actual?.get(attribute);
        const known = KNOWN.some((row) => row.fixture === fixture && row.id === id && row.attribute === attribute);

        if ((want === undefined ? undefined : withoutTokens(want, model)) !== have && !known) {
          differences.push(`${id} ${attribute}: 0.7.0 ${want ?? "-"}, now ${have ?? "-"}`);
        }
      }
    }

    expect(differences).toEqual([]);
    expect(ours.size).toBeGreaterThan(0);
  });

  // C-1.1, C-120: a Text with its Spans is one line; compared whole, the content and every attribute on it.
  it.each(FIXTURES)("writes orbit-%s's Text lines as 0.7.0 did", (fixture) => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read(`./fixtures/orbit-${fixture}.json`)));
    const golden = textLines(read(`./__golden__/orbit-${fixture}.xml`));
    const ours = textLines(design.xml(model));
    const differences = [...golden]
      .filter(([id, line]) => ours.has(id) && withoutTokens(line, model) !== ours.get(id))
      .map(([id, line]) => `0.7.0 ${line}\n  now ${ours.get(id) ?? "-"}`);

    expect(differences).toEqual([]);
    expect(golden.size).toBeGreaterThan(0);
  });

  // C-123: the JSON block's text styles (font shorthand, spacing, case) and each family's weights in order.
  it("lists the text styles and fonts of the Plans row as 0.7.0 did", () => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read("./fixtures/orbit-plans.json")));

    expect(new ReadCatalogue(fonts).read(model)).toEqual({
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

  // C-1.7, B-058: a Display P3 file's colours are P3 values: its read holds no sRGB hex; an sRGB file reads as before.
  it("writes a Display P3 file's colours as color(display-p3 …) and an sRGB file's as before", () => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read("./fixtures/orbit-customers.json")));
    const p3 = design.xml({ ...model, colorProfile: "DISPLAY_P3" });

    expect(p3).toContain("color(display-p3 ");
    expect(p3).not.toMatch(/="[^"]*#[0-9A-Fa-f]{3,8}\b/);
    expect(design.xml({ ...model, colorProfile: "SRGB" })).toBe(design.xml(model));
  });
});
