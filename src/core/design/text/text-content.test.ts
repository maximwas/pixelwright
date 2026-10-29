import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { TextRun, type TextSegment } from "@/core/css/groups/text/text-run.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const lengths = new CssLength(new CssVar(new CssSplit()), format);
const solid = new SolidPaint();
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
);
const content = new TextContent(new TextRun(new FontShorthand(format), paints, format));

function segment(
  characters: string,
  start: number,
  fields: Partial<TextSegment> = {},
): TextSegment {
  return {
    characters,
    start,
    end: start + characters.length,
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
    ...fields,
  };
}

function textLayer(segments: TextSegment[]): ReadLayer {
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
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
  };
}

const model: ReadModel = { model: 1, profile: "design", root: textLayer([]), styles: {}, variables: {} };

describe("TextContent", () => {
  // C-120: the longest run is the text's own; a Span says only what differs, and resets what it lacks.
  it("writes a differing run as a Span with only its differences and the resets", () => {
    const spaced = { letterSpacing: { unit: "PERCENT", value: 5 }, textDecoration: "UNDERLINE" };
    const layer = textLayer([
      segment("Fast and ", 0, spaced),
      segment("free", 9, { fontWeight: 700, fontName: { family: "Inter", style: "Bold" } }),
    ]);

    expect(content.content(layer, model)).toEqual([
      { kind: "text", value: "Fast and " },
      {
        kind: "span",
        attributes: [
          ["font", "700 16px/normal 'Inter'"],
          ["letter-spacing", "0"],
          ["text-decoration", "none"],
        ],
        value: "free",
      },
    ]);
  });

  // C-120: a character limit keeps the first characters and an ellipsis, no Spans.
  it("cuts the text at a character limit with an ellipsis", () => {
    const layer = textLayer([segment("Fast and ", 0), segment("free", 9, { fontWeight: 700 })]);

    expect(content.content(layer, model, 4)).toEqual([
      { kind: "text", value: "Fast" },
      { kind: "text", value: "…" },
    ]);
  });
});
