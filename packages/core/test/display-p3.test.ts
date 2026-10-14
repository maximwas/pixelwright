import { clampRgb, converter, modeP3, modeRgb, useMode, wcagContrast } from "culori/fn";
import { describe, expect, it } from "vitest";
import {
  colorCss,
  colorOf,
  contrastCheck,
  designXml,
  dtcgTrees,
  paintOf,
  type RawTokens,
  type Snapshot,
  type SnapshotNode,
  TokensApplyInputSchema,
  toDocumentColor,
  tokenModel,
  tokensCss,
  tokensPlan,
} from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

useMode(modeRgb);
useMode(modeP3);

const BRAND = {
  r: 0.2314,
  g: 0.1843,
  b: 0.851,
};

const raw = (colorProfile?: string): RawTokens => ({
  collections: [
    {
      id: "C:1",
      name: "Orbit",
      remote: false,
      defaultModeId: "M:1",
      modes: [
        {
          modeId: "M:1",
          name: "Light",
        },
      ],
    },
  ],
  variables: [
    {
      id: "V:brand",
      name: "color/brand",
      collectionId: "C:1",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: {
        "M:1": {
          ...BRAND,
          a: 1,
        },
      },
    },
    {
      id: "V:red",
      name: "color/red",
      collectionId: "C:1",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: {
        "M:1": {
          r: 1,
          g: 0,
          b: 0,
          a: 1,
        },
      },
    },
  ],
  external: {},
  styles: [],
  ...(colorProfile === undefined ? {} : { colorProfile }),
});

describe("colours of a Display P3 file", () => {
  it("are written as color(display-p3 …), with the alpha after a slash, and sRGB ones as before", () => {
    expect(
      colorCss(
        {
          r: 1,
          g: 0,
          b: 0,
        },
        1,
        "display-p3",
      ),
    ).toBe("color(display-p3 1 0 0)");
    expect(
      colorCss(
        {
          r: 1,
          g: 0,
          b: 0,
        },
        0.5,
        "display-p3",
      ),
    ).toBe("color(display-p3 1 0 0 / 0.5)");
    expect(colorCss(BRAND, 1, "display-p3")).toBe("color(display-p3 0.2314 0.1843 0.851)");
    expect(
      colorCss({
        r: 1,
        g: 0,
        b: 0,
      }),
    ).toBe("#F00");
  });

  it("leave no sRGB hex in a read of a P3 file, and a read of an sRGB file as it was", () => {
    const plans = fixture("orbit-customers");
    const p3 = designXml({
      ...plans,
      colorProfile: "DISPLAY_P3",
    });

    expect(p3.xml).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(p3.xml).toContain("color(display-p3 ");
    expect(Object.values(p3.tokens).filter((value) => value.startsWith("#"))).toEqual([]);
    expect(
      designXml({
        ...plans,
        colorProfile: "SRGB",
      }).xml,
    ).toBe(designXml(plans).xml);
  });

  it("give tokens_read and design_read the same string for the same colour", () => {
    const css = tokensCss(tokenModel(raw("DISPLAY_P3")));
    const root: SnapshotNode = {
      id: "1:1",
      name: "Card",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      childCount: 0,
      fills: [
        {
          type: "SOLID",
          visible: true,
          color: BRAND,
          opacity: 1,
          boundVariables: {
            color: {
              type: "VARIABLE_ALIAS",
              id: "V:brand",
            },
          },
        },
      ],
    };
    const snapshot: Snapshot = {
      root,
      styles: {},
      variables: {
        "V:brand": {
          name: "color/brand",
          collection: "Orbit",
          resolvedType: "COLOR",
          remote: false,
          value: {
            ...BRAND,
            a: 1,
          },
        },
      },
      colorProfile: "DISPLAY_P3",
    };

    expect(css).toContain("--color-brand: color(display-p3 0.2314 0.1843 0.851);");
    expect(designXml(snapshot).tokens["--color-brand"]).toBe("color(display-p3 0.2314 0.1843 0.851)");
  });

  it("are DTCG display-p3 colours with an sRGB hex, a colour outside sRGB clipped into it", () => {
    const orbit = dtcgTrees(raw("DISPLAY_P3")).trees.orbit as Record<string, Record<string, { $value: unknown }>>;

    expect(orbit.color?.red?.$value).toEqual({
      colorSpace: "display-p3",
      components: [1, 0, 0],
      hex: "#FF0000",
    });
    expect(
      (dtcgTrees(raw()).trees.orbit as Record<string, Record<string, { $value: unknown }>>).color?.red?.$value,
    ).toEqual({
      colorSpace: "srgb",
      components: [1, 0, 0],
      hex: "#FF0000",
    });
  });

  it("are measured for contrast in sRGB", () => {
    const green = {
      r: 0.2,
      g: 0.6,
      b: 0.3,
    };
    const text: SnapshotNode = {
      id: "1:2",
      name: "Label",
      type: "TEXT",
      visible: true,
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      childCount: 0,
      text: {
        characters: "Go",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [
          {
            characters: "Go",
            start: 0,
            end: 2,
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
                visible: true,
                color: green,
                opacity: 1,
              },
            ],
            fillStyleId: "",
            textStyleId: "",
          },
        ],
      },
    };
    const card: Snapshot = {
      root: {
        id: "1:1",
        name: "Card",
        type: "FRAME",
        visible: true,
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        childCount: 1,
        fills: [
          {
            type: "SOLID",
            visible: true,
            color: {
              r: 1,
              g: 1,
              b: 1,
            },
            opacity: 1,
          },
        ],
        children: [text],
      },
      styles: {},
      variables: {},
      colorProfile: "DISPLAY_P3",
    };
    const expected = wcagContrast(
      clampRgb(
        converter("rgb")({
          mode: "p3",
          ...green,
        }),
      ),
      {
        mode: "rgb",
        r: 1,
        g: 1,
        b: 1,
      },
    );
    const [rated] = contrastCheck(card).texts;

    expect(rated?.ratio).toBeCloseTo(expected, 1);
    expect(rated?.color).toBe("color(display-p3 0.2 0.6 0.3)");
  });

  it("are read from design_apply's input as P3 channels, kept apart from sRGB ones", () => {
    expect(colorOf("color(display-p3 1 0 0)")).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
      space: "display-p3",
    });
    expect(colorOf("#F00")).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it("are written in the document's own space: P3 as it is in a P3 file, sRGB converted; P3 clipped in an sRGB file", () => {
    const p3Red = {
      r: 1,
      g: 0,
      b: 0,
      a: 1,
      space: "display-p3" as const,
    };
    const srgbRed = {
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    };
    const converted = toDocumentColor(srgbRed, "display-p3");

    expect(toDocumentColor(p3Red, "display-p3")).toEqual(srgbRed);
    expect(converted.r).toBeCloseTo(0.9175, 3);
    expect(converted.g).toBeCloseTo(0.2003, 3);
    expect(converted.b).toBeCloseTo(0.1386, 3);
    expect(toDocumentColor(p3Red, "srgb")).toEqual(srgbRed);
    expect(toDocumentColor(srgbRed, "srgb")).toEqual(srgbRed);
  });

  it("are read back from color-mix in display-p3, as design_read and tokens_read mix them in a P3 file", () => {
    expect(paintOf("color-mix(in display-p3, var(--color-brand) 50%, transparent)")).toEqual({
      kind: "token",
      token: "--color-brand",
      opacity: 0.5,
    });

    const { plan, errors } = tokensPlan(
      TokensApplyInputSchema.parse({
        collections: [
          {
            name: "Orbit",
            variables: [
              {
                name: "color/veil",
                values: { Light: "color-mix(in display-p3, color(display-p3 0 0 0) 40%, transparent)" },
              },
            ],
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(plan.collections[0]?.variables[0]?.values.Light).toMatchObject({
      kind: "color",
      color: {
        r: 0,
        g: 0,
        b: 0,
        a: 0.4,
        space: "display-p3",
      },
    });
  });
});
