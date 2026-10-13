import { describe, expect, it } from "vitest";
import { type InspectRaw, inspectView } from "../src/index.ts";

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};

/** The plugin's answer for a text that overflows its card and a centred-stroke line with a hover, in a section. */
const RAW: InspectRaw = {
  origin: {
    id: "2:1",
    name: "Section",
  },
  missing: ["9:9"],
  layers: [
    {
      id: "2:3",
      name: "Title",
      type: "TEXT",
      visible: true,
      x: 20,
      y: 30,
      width: 306,
      height: 38,
      childCount: 0,
      text: {
        characters: "Behind Your\nNext",
        textAutoResize: "HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [
          {
            characters: "Behind Your\nNext",
            start: 0,
            end: 16,
            fontName: {
              family: "Inter",
              style: "Regular",
            },
            fontSize: 16,
            fontWeight: 400,
            textDecoration: "NONE",
            textCase: "ORIGINAL",
            lineHeight: { unit: "AUTO" },
            letterSpacing: {
              unit: "PIXELS",
              value: 0,
            },
            fills: [
              {
                type: "SOLID",
                color: DARK,
              },
            ],
            fillStyleId: "",
            textStyleId: "",
          },
          {
            characters: "",
            start: 16,
            end: 16,
            fontName: {
              family: "Inter",
              style: "Bold",
            },
            fontSize: 20,
            fontWeight: 700,
            textDecoration: "NONE",
            textCase: "ORIGINAL",
            lineHeight: {
              unit: "PERCENT",
              value: 120,
            },
            letterSpacing: {
              unit: "PIXELS",
              value: 0,
            },
            fills: [
              {
                type: "SOLID",
                color: DARK,
              },
            ],
            fillStyleId: "",
            textStyleId: "",
          },
        ],
      },
      parent: {
        id: "2:2",
        name: "Card",
        type: "FRAME",
      },
      box: {
        x: 20,
        y: 30,
        width: 306,
        height: 38,
      },
      paintedBox: {
        x: 20,
        y: 30,
        width: 306,
        height: 38,
      },
      parentBox: {
        x: 20,
        y: 30,
        width: 297,
        height: 200,
      },
      parentPadding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    {
      id: "2:4",
      name: "Rule",
      type: "LINE",
      visible: true,
      x: 0,
      y: 100,
      width: 100,
      height: 0,
      childCount: 0,
      strokes: [
        {
          type: "SOLID",
          color: DARK,
        },
      ],
      strokeWeight: 1,
      strokeAlign: "CENTER",
      effects: [
        {
          type: "LAYER_BLUR",
          visible: true,
          radius: 16,
          blurType: "PROGRESSIVE",
          startRadius: 0,
          startOffset: {
            x: 0.5,
            y: 0,
          },
          endOffset: {
            x: 0.5,
            y: 1,
          },
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
              transition: {
                type: "SMART_ANIMATE",
                duration: 0.3,
                easing: { type: "EASE_OUT" },
              },
            },
          ],
        },
      ],
      parent: {
        id: "2:1",
        name: "Section",
        type: "SECTION",
      },
      box: {
        x: 0,
        y: 100,
        width: 100,
        height: 0,
      },
      paintedBox: {
        x: -0.5,
        y: 99.5,
        width: 101,
        height: 1,
      },
      parentBox: {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      },
      parentPadding: null,
    },
  ],
};

describe("inspect", () => {
  it("names what the boxes are relative to and which ids it could not find", () => {
    const view = inspectView(RAW);

    expect(view.relativeTo).toBe('2:1 "Section"');
    expect(view.missing).toEqual(["9:9"]);
  });

  it("gives a text's lines with what ended each, its line heights, and how far it overflows its parent", () => {
    const [title] = inspectView(RAW).layers;

    expect(title?.text?.lines).toEqual([
      {
        text: "Behind",
        break: "line",
      },
      {
        text: "Your",
        break: "paragraph",
      },
      {
        text: "Next",
        break: null,
      },
    ]);
    expect(title?.text?.lineHeights).toEqual(["auto", "120% (24px)"]);
    expect(title?.overflow).toEqual({ right: 9 });
    expect(title?.paintedBox).toBeUndefined();
  });

  it("gives how a stroke paints, the painted box, every effect as Figma has it, and the interactions", () => {
    const [, rule] = inspectView(RAW).layers;

    expect(rule?.strokes).toEqual({
      align: "center",
      weight: 1,
      colors: ["#191A23"],
    });
    expect(rule?.paintedBox).toEqual({
      x: -0.5,
      y: 99.5,
      width: 101,
      height: 1,
    });
    expect(rule?.effects?.[0]).toMatchObject({
      blurType: "PROGRESSIVE",
      startRadius: 0,
      radius: 16,
    });
    expect(rule?.interactions?.[0]).toMatchObject({
      trigger: "ON_HOVER",
      summary: "change to Type=Hover; smart animate 300ms ease-out",
    });
  });
});

describe("inspect fills", () => {
  const white = {
    type: "SOLID",
    color: {
      r: 1,
      g: 1,
      b: 1,
    },
  };
  const base = RAW.layers[1] as InspectRaw["layers"][number];
  const fills = (fields: Partial<InspectRaw["layers"][number]>, raw: Partial<InspectRaw> = {}) =>
    inspectView({
      origin: null,
      missing: [],
      ...raw,
      layers: [
        {
          ...base,
          type: "RECTANGLE",
          reactions: [],
          ...fields,
        },
      ],
    }).layers[0]?.fills;

  it("gives the fill as its CSS value with the style it comes from", () => {
    expect(
      fills(
        {
          fills: [white],
          fillStyleId: "S:w",
        },
        {
          styles: {
            "S:w": {
              name: "White",
              type: "PAINT",
              remote: true,
              paints: [white],
            },
          },
        },
      ),
    ).toEqual({
      css: "#FFF",
      style: {
        name: "White",
        token: "--White",
      },
    });
  });

  it("names the variables a fill is bound to, with their values", () => {
    expect(
      fills(
        {
          fills: [
            {
              ...white,
              boundVariables: {
                color: {
                  type: "VARIABLE_ALIAS",
                  id: "V:1",
                },
              },
            },
          ],
        },
        {
          variables: {
            "V:1": {
              name: "color/bg",
              collection: "Colors",
              resolvedType: "COLOR",
              remote: false,
              value: DARK,
            },
          },
        },
      ),
    ).toEqual({
      css: "var(--color-bg)",
      tokens: { "--color-bg": "#191A23" },
    });
  });

  it("gives a gradient as Figma writes it", () => {
    expect(
      fills({
        fills: [
          {
            type: "GRADIENT_LINEAR",
            gradientStops: [],
          },
        ],
        css: { background: "linear-gradient(90deg, #FFF 0%, #000 100%)" },
      }),
    ).toEqual({ css: "linear-gradient(90deg, #FFF 0%, #000 100%)" });
  });
});
