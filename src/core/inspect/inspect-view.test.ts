import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { InspectFills } from "@/core/inspect/inspect-fills.ts";
import { InspectLayout } from "@/core/inspect/inspect-layout.ts";
import { InspectView } from "@/core/inspect/inspect-view.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { InspectedLayer, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const solid = new SolidPaint(names);
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const view = new InspectView(
  format,
  new InspectFills(paints, solid, names),
  new InteractionAttributes(new EasingCss(format)),
  new InspectLayout(new LayoutGroup(lengths, format), lengths),
);

const DARK = { r: 0.098, g: 0.102, b: 0.137 };

/** A layer as the inspect op gives it: a 100 x 40 box at the page's corner, with no parent. */
function layer(fields: Partial<InspectedLayer>): InspectedLayer {
  const box = { x: 0, y: 0, width: 100, height: 40 };

  return {
    id: "2:1",
    name: "Box",
    type: "RECTANGLE",
    visible: true,
    ...box,
    childCount: 0,
    parent: null,
    box,
    paintedBox: null,
    parentBox: null,
    parentPadding: null,
    ...fields,
  };
}

function raw(layers: InspectedLayer[], fields: Partial<InspectRaw> = {}): InspectRaw {
  return { origin: null, layers, missing: [], styles: {}, variables: {}, ...fields };
}

const segment = (
  characters: string,
  fontSize: number,
  lineHeight: { unit: string; value?: number },
) => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: { family: "Inter", style: "Regular" },
  fontSize,
  fontWeight: 400,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight,
  letterSpacing: { unit: "PIXELS", value: 0 },
  fills: [],
  fillStyleId: "",
  textStyleId: "",
});

/** A text that overflows its card by 9 px, and a centred-stroke line with a progressive blur and a hover. */
const TITLE = layer({
  id: "2:3",
  name: "Title",
  type: "TEXT",
  text: {
    characters: "Behind Your\nNext",
    textAutoResize: "HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    segments: [segment("Behind Your\nNext", 16, { unit: "AUTO" }), segment("", 20, { unit: "PERCENT", value: 120 })],
  },
  parent: { id: "2:2", name: "Card", type: "FRAME" },
  box: { x: 20, y: 30, width: 306, height: 38 },
  paintedBox: { x: 20, y: 30, width: 306, height: 38 },
  parentBox: { x: 20, y: 30, width: 297, height: 200 },
  parentPadding: { top: 0, right: 0, bottom: 0, left: 0 },
});

const RULE = layer({
  id: "2:4",
  name: "Rule",
  type: "LINE",
  strokes: [{ type: "SOLID", color: DARK }],
  strokeWeight: 1,
  strokeAlign: "CENTER",
  effects: [
    {
      type: "LAYER_BLUR",
      visible: true,
      radius: 16,
      blurType: "PROGRESSIVE",
      startRadius: 0,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 },
    },
  ],
  reactions: [
    {
      trigger: { type: "ON_HOVER" },
      actions: [
        {
          type: "NODE",
          destinationId: "5:2",
          destinationName: "Type=Hover",
          navigation: "CHANGE_TO",
          transition: { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } },
        },
      ],
    },
  ],
  box: { x: 0, y: 100, width: 100, height: 0 },
  paintedBox: { x: -0.5, y: 99.5, width: 101, height: 1 },
});

describe("inspect", () => {
  // T14: the ancestors by id, and the page they hang on.
  it("gives a layer's path and the page it is on, and leaves both out for a layer at the page's top", () => {
    const page = { id: "0:1", name: "Pricing" };
    const [nested, top] = view.build(
      raw([layer({ path: [{ id: "2:9", name: "Card", type: "FRAME" }], page }), layer({ id: "2:2", path: [], page })]),
    ).layers;

    expect(nested?.path).toEqual([{ id: "2:9", name: "Card", type: "FRAME" }]);
    expect(nested?.page).toEqual(page);
    expect(top?.page).toEqual(page);
  });

  it("names what the boxes are relative to and which ids it could not find", () => {
    const answer = view.build(raw([TITLE], { origin: { id: "2:1", name: "Section" }, missing: ["9:9"] }));

    expect(answer.relativeTo).toBe('2:1 "Section"');
    expect(answer.missing).toEqual(["9:9"]);
  });

  // T-080: what design_read's CSS cannot say.
  it("gives a text's lines with what ended each, its line heights, and how far it overflows its parent", () => {
    const [title] = view.build(raw([TITLE])).layers;

    expect(title?.text?.lines).toEqual([
      { text: "Behind", break: "line" },
      { text: "Your", break: "paragraph" },
      { text: "Next", break: null },
    ]);
    expect(title?.text?.lineHeights).toEqual(["auto", "120% (24px)"]);
    expect(title?.overflow).toEqual({ right: 9 });
    expect(title?.paintedBox).toBeUndefined();
  });

  it("gives how a stroke paints, the painted box, every effect as Figma has it, and the interactions", () => {
    const [rule] = view.build(raw([RULE])).layers;

    expect(rule?.strokes).toEqual({ align: "center", weight: 1, colors: ["#191A23"] });
    expect(rule?.paintedBox).toEqual({ x: -0.5, y: 99.5, width: 101, height: 1 });
    expect(rule?.effects?.[0]).toMatchObject({ blurType: "PROGRESSIVE", startRadius: 0, radius: 16 });
    expect(rule?.interactions?.[0]).toMatchObject({
      trigger: "ON_HOVER",
      summary: "change to Type=Hover; smart animate 300ms ease-out",
    });
  });

  // B-002: the layer's blend mode, as Figma names it and as CSS's mix-blend-mode, beside its blur.
  it("gives a soft-light layer's blend mode with its CSS name", () => {
    const [ellipse] = view.build(
      raw([
        layer({
          type: "ELLIPSE",
          blendMode: "SOFT_LIGHT",
          effects: [{ type: "LAYER_BLUR", visible: true, radius: 20 }],
        }),
      ]),
    ).layers;

    expect(ellipse).toMatchObject({ blendMode: "SOFT_LIGHT", mixBlendMode: "soft-light" });
    expect(ellipse?.effects).toEqual([{ type: "LAYER_BLUR", visible: true, radius: 20 }]);
  });
});

// T-082, K-060: distance and the CSS rotate() angle from a point, rounded after the modulo.
describe("inspect around a point", () => {
  /** A 20 px dot whose centre is at (x, y). */
  const dot = (
    id: string,
    x: number,
    y: number,
  ) =>
    layer({ id, name: id, type: "ELLIPSE", box: { x: x - 10, y: y - 10, width: 20, height: 20 } });
  // Dots on a ring of radius 100 around (200, 200): each quarter, two between, one a hair left of the top, the hub.
  const ring = raw([
    dot("top", 200, 100),
    dot("right", 300, 200),
    dot("bottom", 200, 300),
    dot("left", 100, 200),
    dot("top right", 270.71, 129.29),
    dot("top left", 129.29, 129.29),
    dot("a hair left of the top", 199.999, 100),
    dot("hub", 200, 200),
  ]);

  it("gives every layer its centre, in the origin its box uses, and no distance without a point", () => {
    const [top, right] = view.build(ring).layers;

    expect(top?.center).toEqual({ x: 200, y: 100 });
    expect(right?.center).toEqual({ x: 300, y: 200 });
    expect(top).not.toHaveProperty("distance");
    expect(top).not.toHaveProperty("angle");
  });

  it("gives each layer's distance and angle from the point as CSS rotate() turns: 0 at the top, clockwise; 359.999 is 0", () => {
    const answer = view.build(ring, { x: 200, y: 200 });

    expect(answer.around).toEqual({ x: 200, y: 200 });
    expect(answer.layers.map(({ id, distance, angle }) => [id, distance, angle])).toEqual([
      ["top", 100, 0],
      ["right", 100, 90],
      ["bottom", 100, 180],
      ["left", 100, 270],
      ["top right", 100, 45],
      ["top left", 100, 315],
      ["a hair left of the top", 100, 0],
      ["hub", 0, undefined],
    ]);
  });

  it("rounds an angle with decimals to two places, with no float noise from the turn past 360", () => {
    const answer = view.build(
      raw([dot("past the top", 200.3316, 100.0005), dot("a hair below the right", 299.9982, 200.192)]),
      { x: 200, y: 200 },
    );

    expect(answer.layers.map(({ angle }) => angle)).toEqual([0.19, 90.11]);
  });
});

describe("inspect's layout and component properties", () => {
  // design_read's names, as longhands and px numbers; a bound side reads its number, its token stays in bound.
  it("gives a wrapping auto layout's padding, gap and line gap as design_read's CSS longhands in px", () => {
    const frame = layer({
      type: "FRAME",
      childCount: 3,
      layoutMode: "HORIZONTAL",
      layoutWrap: "WRAP",
      paddingTop: 6,
      paddingRight: 10,
      paddingBottom: 6,
      paddingLeft: 10,
      itemSpacing: 6,
      counterAxisSpacing: 8,
      boundVariables: { paddingTop: { type: "VARIABLE_ALIAS", id: "V:6" } },
    });

    expect(view.build(raw([frame])).layers[0]?.layout).toEqual({
      display: "flex",
      "flex-wrap": "wrap",
      "padding-top": 6,
      "padding-right": 10,
      "padding-bottom": 6,
      "padding-left": 10,
      gap: 6,
      "row-gap": 8,
    });
  });

  it("names a run's font style as the face (fontName.style), not Figma's own fontStyle enum", () => {
    const text = layer({
      type: "TEXT",
      text: {
        characters: "ab",
        textAutoResize: "HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [
          { ...segment("a", 14, { unit: "AUTO" }), fontName: { family: "Inter", style: "Bold" }, fontStyle: "BOLD" },
          segment("b", 16, { unit: "AUTO" }),
        ],
      },
    });

    expect(view.build(raw([text])).layers[0]?.text?.segments?.[0]?.fontStyle).toBe("Bold");
  });

  it("gives an instance's every property with its value and the component's default, Figma's #id left out", () => {
    const card = layer({
      type: "INSTANCE",
      instance: {
        componentId: "1:1",
        componentName: "Plan Card",
        componentKey: "k",
        properties: {
          "Name#1:0": { type: "TEXT", value: "Starter" },
          "Popular#1:1": { type: "BOOLEAN", value: false },
        },
      },
      defaults: { "Name#1:0": "Pro", "Popular#1:1": false },
    });

    expect(view.build(raw([card])).layers[0]?.component?.properties).toEqual({
      Name: { type: "TEXT", value: "Starter", default: "Pro" },
      Popular: { type: "BOOLEAN", value: false, default: false },
    });
  });
});
