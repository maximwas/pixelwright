import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { TextGroup } from "@/core/css/groups/text/text-group.ts";
import { TextRun, type TextSegment } from "@/core/css/groups/text/text-run.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
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
const group = new TextGroup(
  new TextRun(new FontShorthand(format, new FontWeight()), paints, format, new TokenNames()),
  lengths,
);

const BODY = "S:body";

/** A run of Inter Regular 16/24 with the fields the case sets. */
function segment(fields: Partial<TextSegment> = {}): TextSegment {
  return {
    characters: "Hello",
    start: 0,
    end: 5,
    fontName: { family: "Inter", style: "Regular", variationSettings: { slnt: 0, wght: 400 } },
    fontSize: 16,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "PIXELS", value: 24 },
    letterSpacing: { unit: "PERCENT", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
    ...fields,
  };
}

function textLayer(
  segments: TextSegment[],
  layer: Partial<ReadLayer> = {},
  text: Partial<NonNullable<ReadLayer["text"]>> = {},
): ReadLayer {
  return {
    id: "1:1",
    type: "TEXT",
    name: "Copy",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    childCount: 0,
    text: {
      characters: segments.map((run) => run.characters).join(""),
      textAutoResize: "HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
      ...text,
    },
    ...layer,
  };
}

const model: ReadModel = {
  model: 1,
  profile: "design",
  root: textLayer([]),
  styles: {
    [BODY]: {
      name: "Body",
      type: "TEXT",
      remote: false,
      fontName: { family: "Inter", style: "Regular" },
      fontSize: 16,
      lineHeight: { unit: "PIXELS", value: 24 },
      letterSpacing: { unit: "PERCENT", value: 0 },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    },
  },
  variables: {},
};

function read(layer: ReadLayer) {
  const css = new CssDeclarations();

  group.read({ layer, parent: null, model, css });

  return css.build();
}

describe("TextGroup", () => {
  // C-111: the style covers the font (family and style compared, the run's axes aside); the run's own case stays.
  it("names the run's text style and leaves out what the style covers", () => {
    const css = read(textLayer([segment({ textStyleId: BODY, textCase: "UPPER" })]));

    expect(css.textStyle).toBe("Body");
    expect(css.properties).toEqual([["text-transform", "uppercase"]]);
  });

  // C-117, FX-066: wght said by the weight, opsz at the size, slnt 0 and wdth 100 are what a browser draws anyway.
  it("notes OpenType features and only the axes a browser would not draw by itself", () => {
    const css = read(
      textLayer([
        segment({
          fontName: {
            family: "Inter",
            style: "Regular",
            variationSettings: { wght: 400, slnt: 0, wdth: 100, opsz: 16, GRAD: 50 },
          },
          openTypeFeatures: { SS01: true, LIGA: false },
        }),
      ]),
    );

    expect(css.notes).toEqual([
      ["font-feature-settings", '"ss01" 1, "liga" 0'],
      ["font-variation-settings", '"GRAD" 50'],
    ]);
  });

  // C-116: align and wrap are CSS; vertical align on a fixed height, lists and paragraph spacing are notes.
  it("reads the block's alignment, wrap, vertical alignment, list and paragraph spacing", () => {
    const css = read(
      textLayer(
        [segment({ textWrapStyle: "BALANCE", listOptions: { type: "ORDERED" } })],
        { layoutSizingVertical: "FIXED" },
        { textAlignHorizontal: "CENTER", textAlignVertical: "BOTTOM", paragraphSpacing: 8 },
      ),
    );

    expect(css.properties).toEqual([
      ["font", "400 16px/24px 'Inter'"],
      ["text-align", "center"],
      ["text-wrap", "balance"],
    ]);
    expect(css.notes).toEqual([
      ["align-content", "end"],
      ["list-style", "decimal"],
      ["paragraph-spacing", "8px"],
    ]);
  });

  // C-110: a text whose runs differ in colour takes the colour of the run covering the most characters.
  it("gives a text with mixed fills the colour of its longest run", () => {
    const red = { type: "SOLID", color: { r: 1, g: 0, b: 0 } };
    const blue = { type: "SOLID", color: { r: 0, g: 0, b: 1 } };
    const css = read(
      textLayer(
        [
          segment({ characters: "Hi ", end: 3, fills: [red] }),
          segment({ characters: "there", start: 3, end: 8, fills: [blue] }),
        ],
        { fills: "mixed" },
      ),
    );

    expect(css.properties).toContainEqual(["color", "#00F"]);
  });

  // C-110 (0.7.0's rule): a text's one colour is the fills group's; the text group writes it for mixed fills only.
  it("leaves a text's one colour to the fills group", () => {
    const red = { type: "SOLID", color: { r: 1, g: 0, b: 0 } };
    const css = read(textLayer([segment({ fills: [red] })], { fills: [red] }));

    expect(css.properties.map(([property]) => property)).not.toContain("color");
  });
});
