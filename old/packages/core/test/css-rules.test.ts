import { describe, expect, it } from "vitest";
import { type CssContext, nodeCss, type SnapshotNode, type TextSegment } from "../src/index.ts";

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};

const layer = (fields: Partial<SnapshotNode>): SnapshotNode => ({
  id: "1:2",
  name: "Layer",
  type: "FRAME",
  visible: true,
  x: 10,
  y: 20,
  width: 100,
  height: 40,
  childCount: 0,
  ...fields,
});

const frame = (fields: Partial<SnapshotNode> = {}) =>
  layer({
    id: "1:1",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    ...fields,
  });

function cssOf(node: SnapshotNode, parent: SnapshotNode | null = frame(), extra: Partial<CssContext> = {}) {
  const context: CssContext = {
    styles: {},
    variables: {},
    tokens: new Map(),
    root: parent ?? node,
    ...extra,
  };

  return {
    ...nodeCss(node, parent, context),
    tokens: Object.fromEntries(context.tokens),
  };
}

const segment = (fields: Partial<TextSegment> = {}): TextSegment => ({
  characters: "Hello",
  start: 0,
  end: 5,
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
    unit: "PERCENT",
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
  ...fields,
});

describe("CSS mapping rules", () => {
  it("stretches a FILL child along its parent's main axis with flex, across it with align-self", () => {
    const row = frame({ layoutMode: "HORIZONTAL" });

    expect(
      cssOf(
        layer({
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "FILL",
        }),
        row,
      ).properties,
    ).toEqual([
      ["flex", "1"],
      ["align-self", "stretch"],
    ]);
  });

  it("draws a standing line as a left border of its length, a flat one as a top border", () => {
    const line = {
      type: "LINE",
      width: 18,
      height: 0,
      strokes: [
        {
          type: "SOLID",
          color: DARK,
        },
      ],
      strokeWeight: 1,
    };

    expect(
      cssOf(
        layer({
          ...line,
          rotation: 90,
        }),
        frame({ layoutMode: "HORIZONTAL" }),
      ).properties,
    ).toEqual([
      ["height", "18px"],
      ["border-left", "1px solid #191A23"],
    ]);
    expect(cssOf(layer(line), frame({ layoutMode: "HORIZONTAL" })).properties).toEqual([
      ["width", "18px"],
      ["border-top", "1px solid #191A23"],
    ]);
  });

  it("writes bound variables as tokens, in paints and in spacing", () => {
    const { properties, tokens } = cssOf(
      frame({
        layoutMode: "HORIZONTAL",
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        boundVariables: {
          paddingTop: {
            type: "VARIABLE_ALIAS",
            id: "V:space",
          },
        },
        fills: [
          {
            type: "SOLID",
            color: DARK,
            boundVariables: {
              color: {
                type: "VARIABLE_ALIAS",
                id: "V:dark",
              },
            },
          },
        ],
      }),
      null,
      {
        variables: {
          "V:dark": {
            name: "Colors/Dark",
            collection: "Brand",
            resolvedType: "COLOR",
            remote: false,
            value: DARK,
          },
          "V:space": {
            name: "space/4",
            collection: "Spacing",
            resolvedType: "FLOAT",
            remote: false,
            value: 16,
            codeSyntax: { WEB: "var(--space-4)" },
          },
        },
      },
    );

    expect(properties).toEqual(
      expect.arrayContaining([
        ["padding", "var(--space-4) 16px 16px"],
        ["background", "var(--Colors-Dark)"],
      ]),
    );
    expect(tokens).toEqual({
      "--Colors-Dark": "#191A23",
      "--space-4": "16px",
    });
  });

  it("leaves a gradient to read-only CSS, and puts an image layer under a color as background layers", () => {
    const gradient = cssOf(
      layer({
        fills: [{ type: "GRADIENT_LINEAR" }],
        css: { background: "linear-gradient(90deg, #000 0%, #FFF 100%)" },
      }),
    );

    expect(gradient.properties).not.toContainEqual(expect.arrayContaining(["background"]));
    expect(gradient.readOnly).toEqual([["background", "linear-gradient(90deg, #000 0%, #FFF 100%)"]]);

    const layered = cssOf(
      layer({
        fills: [
          {
            type: "IMAGE",
            imageHash: "abc",
            scaleMode: "FIT",
          },
          {
            type: "SOLID",
            color: DARK,
            opacity: 0.5,
          },
        ],
      }),
    );

    expect(layered.properties).toContainEqual([
      "background",
      "linear-gradient(rgba(25, 26, 35, 0.5), rgba(25, 26, 35, 0.5)), url(assets/abc.png) center / contain no-repeat",
    ]);
  });

  it("writes an outside stroke as an outline, per-side weights as side borders, mixed radii as four", () => {
    const stroke = [
      {
        type: "SOLID",
        color: DARK,
      },
    ];

    expect(
      cssOf(
        layer({
          strokes: stroke,
          strokeWeight: 2,
          strokeAlign: "OUTSIDE",
        }),
      ).properties,
    ).toContainEqual(["outline", "2px solid #191A23"]);
    expect(
      cssOf(
        layer({
          strokes: stroke,
          strokeWeight: "mixed",
          strokeTopWeight: 0,
          strokeRightWeight: 0,
          strokeBottomWeight: 1,
          strokeLeftWeight: 0,
          cornerRadius: "mixed",
          topLeftRadius: 8,
          topRightRadius: 8,
          bottomRightRadius: 0,
          bottomLeftRadius: 0,
        }),
      ).properties,
    ).toEqual(
      expect.arrayContaining([
        ["border-bottom", "1px solid #191A23"],
        ["border-radius", "8px 8px 0 0"],
      ]),
    );
  });

  it("keeps a stroke weight's fractions on a border, an outline, one side and a line, its lengths whole", () => {
    const stroke = [
      {
        type: "SOLID",
        color: DARK,
      },
    ];

    expect(
      cssOf(
        layer({
          strokes: stroke,
          strokeWeight: 2.5,
        }),
      ).properties,
    ).toContainEqual(["border", "2.5px solid #191A23"]);
    expect(
      cssOf(
        layer({
          strokes: stroke,
          strokeWeight: 1.333,
          strokeAlign: "OUTSIDE",
        }),
      ).properties,
    ).toContainEqual(["outline", "1.33px solid #191A23"]);
    expect(
      cssOf(
        layer({
          strokes: stroke,
          strokeWeight: "mixed",
          strokeTopWeight: 0,
          strokeRightWeight: 0,
          strokeBottomWeight: 0.5,
          strokeLeftWeight: 0,
        }),
      ).properties,
    ).toContainEqual(["border-bottom", "0.5px solid #191A23"]);
    expect(
      cssOf(
        layer({
          type: "LINE",
          width: 18.4,
          height: 0,
          strokes: stroke,
          strokeWeight: 0.75,
        }),
        frame({ layoutMode: "HORIZONTAL" }),
      ).properties,
    ).toEqual([
      ["width", "18px"],
      ["border-top", "0.75px solid #191A23"],
    ]);
  });

  it("lists shadows top first with inset ones marked, and a blur as Figma renders its radius", () => {
    const { properties } = cssOf(
      layer({
        effects: [
          {
            type: "DROP_SHADOW",
            color: {
              ...DARK,
              a: 0.25,
            },
            offset: {
              x: 0,
              y: 4,
            },
            radius: 8,
            spread: 0,
          },
          {
            type: "INNER_SHADOW",
            color: {
              ...DARK,
              a: 1,
            },
            offset: {
              x: 0,
              y: -1,
            },
            radius: 0,
            spread: 0,
          },
          {
            type: "BACKGROUND_BLUR",
            radius: 20,
          },
        ],
      }),
    );

    expect(properties).toEqual(
      expect.arrayContaining([
        ["box-shadow", "inset 0 -1px 0 0 #191A23, 0 4px 8px 0 rgba(25, 26, 35, 0.25)"],
        ["backdrop-filter", "blur(8.6px)"],
      ]),
    );
  });

  it("writes a text's case, decoration, spacing and alignment, italic in the font", () => {
    const { properties } = cssOf(
      layer({
        type: "TEXT",
        layoutSizingHorizontal: "FIXED",
        layoutSizingVertical: "HUG",
        text: {
          characters: "Hello",
          textAutoResize: "HEIGHT",
          textAlignHorizontal: "CENTER",
          textAlignVertical: "TOP",
          segments: [
            segment({
              fontName: {
                family: "Inter",
                style: "Bold Italic",
              },
              fontWeight: 700,
              lineHeight: {
                unit: "PERCENT",
                value: 150,
              },
              letterSpacing: {
                unit: "PERCENT",
                value: 4,
              },
              textCase: "UPPER",
              textDecoration: "UNDERLINE",
            }),
          ],
        },
      }),
      frame({ layoutMode: "VERTICAL" }),
    );

    expect(properties).toEqual([
      ["width", "100px"],
      ["font", "italic 700 16px/24px 'Inter'"],
      ["letter-spacing", "0.04em"],
      ["text-transform", "uppercase"],
      ["text-decoration", "underline"],
      ["text-align", "center"],
      ["color", "#191A23"],
    ]);
  });

  it("keeps a variable font's axes the font shorthand does not say, and matches its text style by family and style", () => {
    const { properties, readOnly, textStyle } = cssOf(
      layer({
        type: "TEXT",
        layoutSizingHorizontal: "HUG",
        layoutSizingVertical: "HUG",
        text: {
          characters: "Hello",
          textAutoResize: "WIDTH_AND_HEIGHT",
          textAlignHorizontal: "LEFT",
          textAlignVertical: "TOP",
          segments: [
            segment({
              fontName: {
                family: "Inter",
                style: "Regular",
                variationSettings: {
                  wght: 400,
                  opsz: 14,
                },
              },
              textStyleId: "S:body",
            }),
          ],
        },
      }),
      frame({ layoutMode: "VERTICAL" }),
      {
        styles: {
          "S:body": {
            name: "Body",
            type: "TEXT",
            remote: false,
            fontName: {
              family: "Inter",
              style: "Regular",
            },
            fontSize: 16,
            lineHeight: { unit: "AUTO" },
            letterSpacing: {
              unit: "PIXELS",
              value: 0,
            },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
          },
        },
      },
    );

    expect(textStyle).toBe("Body");
    expect(properties).toEqual([["color", "#191A23"]]);
    expect(readOnly).toEqual([["font-variation-settings", '"opsz" 14']]);
  });

  it("leaves out a variable font's axes at what a browser draws anyway (upright, normal width, optical size at the size)", () => {
    const axesOf = (variationSettings: Record<string, number>) =>
      cssOf(
        layer({
          type: "TEXT",
          layoutSizingHorizontal: "HUG",
          layoutSizingVertical: "HUG",
          text: {
            characters: "Hello",
            textAutoResize: "WIDTH_AND_HEIGHT",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            segments: [
              segment({
                fontName: {
                  family: "Inter",
                  style: "Regular",
                  variationSettings,
                },
              }),
            ],
          },
        }),
        frame({ layoutMode: "VERTICAL" }),
      ).readOnly;

    expect(
      axesOf({
        wght: 400,
        slnt: 0,
      }),
    ).toEqual([]);
    expect(
      axesOf({
        slnt: 0,
        ital: 0,
        wdth: 100,
      }),
    ).toEqual([]);
    expect(
      axesOf({
        slnt: -10,
        wdth: 100,
      }),
    ).toEqual([["font-variation-settings", '"slnt" -10']]);
    // Optical size at the font size is what a browser picks itself (font-optical-sizing: auto).
    expect(axesOf({ opsz: 16 })).toEqual([]);
  });
});
