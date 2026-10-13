import { describe, expect, it } from "vitest";
import { dtcgTrees, type RawTokens } from "../src/index.ts";

const rgb = (r: number, g: number, b: number, a = 1) => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
  a,
});

const variable = (
  fields: Partial<RawTokens["variables"][number]> & { id: string; name: string; valuesByMode: Record<string, unknown> },
) => ({
  collectionId: "C:orbit",
  resolvedType: "COLOR",
  scopes: ["ALL_SCOPES"],
  ...fields,
});

const style = (fields: Record<string, unknown> & { id: string; name: string; type: string }) =>
  ({
    remote: false,
    ...fields,
  }) as RawTokens["styles"][number];

const RAW: RawTokens = {
  collections: [
    {
      id: "C:orbit",
      name: "Orbit",
      remote: false,
      defaultModeId: "M:o",
      modes: [
        {
          modeId: "M:o",
          name: "Light",
        },
      ],
    },
    {
      id: "C:theme",
      name: "Brand Theme",
      remote: false,
      defaultModeId: "M:l",
      modes: [
        {
          modeId: "M:l",
          name: "Light",
        },
        {
          modeId: "M:d",
          name: "Dark Mode",
        },
      ],
    },
  ],
  variables: [
    variable({
      id: "V:brand",
      name: "color/brand",
      description: "The one accent.",
      valuesByMode: { "M:o": rgb(59, 47, 217) },
    }),
    variable({
      id: "V:hover",
      name: "color/brand/hover",
      valuesByMode: { "M:o": rgb(42, 32, 184) },
    }),
    variable({
      id: "V:veil",
      name: "color/veil",
      valuesByMode: { "M:o": rgb(0, 0, 0, 0.5) },
    }),
    variable({
      id: "V:space",
      name: "space/16",
      resolvedType: "FLOAT",
      scopes: ["GAP", "WIDTH_HEIGHT"],
      valuesByMode: { "M:o": 16 },
    }),
    variable({
      id: "V:half",
      name: "space/1.5",
      resolvedType: "FLOAT",
      scopes: ["GAP"],
      valuesByMode: { "M:o": 6 },
    }),
    variable({
      id: "V:bold",
      name: "font/weight/bold",
      resolvedType: "FLOAT",
      scopes: ["FONT_WEIGHT"],
      valuesByMode: { "M:o": 700 },
    }),
    variable({
      id: "V:ratio",
      name: "ratio",
      resolvedType: "FLOAT",
      scopes: [],
      valuesByMode: { "M:o": 1.5 },
    }),
    variable({
      id: "V:family",
      name: "font/family",
      resolvedType: "STRING",
      scopes: ["FONT_FAMILY"],
      valuesByMode: { "M:o": "Inter" },
    }),
    variable({
      id: "V:label",
      name: "copy/label",
      resolvedType: "STRING",
      scopes: ["TEXT_CONTENT"],
      valuesByMode: { "M:o": "Buy" },
    }),
    variable({
      id: "V:beta",
      name: "flag/beta",
      resolvedType: "BOOLEAN",
      valuesByMode: { "M:o": true },
    }),
    variable({
      id: "V:surface",
      name: "surface",
      collectionId: "C:theme",
      valuesByMode: {
        "M:l": rgb(255, 255, 255),
        "M:d": {
          type: "VARIABLE_ALIAS",
          id: "V:brand",
        },
      },
    }),
    variable({
      id: "V:accent",
      name: "accent",
      collectionId: "C:theme",
      valuesByMode: {
        "M:l": {
          type: "VARIABLE_ALIAS",
          id: "V:lib",
        },
        "M:d": {
          type: "VARIABLE_ALIAS",
          id: "V:hover",
        },
      },
    }),
  ],
  external: {
    "V:lib": {
      name: "Accent/Primary",
      collection: "Core",
      resolvedType: "COLOR",
    },
  },
  styles: [
    style({
      id: "S:primary",
      name: "Brand/Primary",
      type: "PAINT",
      paints: [
        {
          type: "SOLID",
          visible: true,
          color: rgb(59, 47, 217),
        },
      ],
    }),
    style({
      id: "S:gradient",
      name: "Hero gradient",
      type: "PAINT",
      paints: [
        {
          type: "GRADIENT_LINEAR",
          visible: true,
          gradientStops: [
            {
              position: 0,
              color: rgb(59, 47, 217),
            },
            {
              position: 1,
              color: rgb(139, 92, 246),
            },
          ],
          gradientTransform: [
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
      ],
    }),
    style({
      id: "S:photo",
      name: "Photo",
      type: "PAINT",
      paints: [
        {
          type: "IMAGE",
          visible: true,
          imageHash: "abc",
          scaleMode: "FILL",
        },
      ],
    }),
    style({
      id: "S:h3",
      name: "Heading/H3",
      type: "TEXT",
      fontName: {
        family: "Space Grotesk",
        style: "Medium",
      },
      fontSize: 24,
      lineHeight: {
        unit: "PIXELS",
        value: 30,
      },
      letterSpacing: {
        unit: "PERCENT",
        value: -1,
      },
    }),
    style({
      id: "S:body",
      name: "Body",
      type: "TEXT",
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
    }),
    style({
      id: "S:card",
      name: "Shadow/Card",
      type: "EFFECT",
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: {
            r: 0.078,
            g: 0.086,
            b: 0.122,
            a: 0.12,
          },
          offset: {
            x: 0,
            y: 12,
          },
          radius: 32,
          spread: -8,
        },
      ],
    }),
    style({
      id: "S:well",
      name: "Shadow/Well",
      type: "EFFECT",
      effects: [
        {
          type: "INNER_SHADOW",
          visible: true,
          color: rgb(0, 0, 0, 0.25),
          offset: {
            x: 0,
            y: 2,
          },
          radius: 4,
          spread: 0,
        },
        {
          type: "DROP_SHADOW",
          visible: true,
          color: rgb(0, 0, 0, 0.1),
          offset: {
            x: 0,
            y: 1,
          },
          radius: 2,
          spread: 0,
        },
      ],
    }),
    style({
      id: "S:glass",
      name: "Glass",
      type: "EFFECT",
      effects: [
        {
          type: "LAYER_BLUR",
          visible: true,
          radius: 8,
        },
      ],
    }),
  ],
};

const BRAND = {
  colorSpace: "srgb",
  components: [0.2314, 0.1843, 0.851],
  hex: "#3B2FD9",
};

describe("DTCG trees", () => {
  it("makes one tree per collection mode, a one-mode collection keyed by its name alone, and one for styles", () => {
    expect(Object.keys(dtcgTrees(RAW).trees)).toEqual([
      "orbit",
      "brand-theme.light",
      "brand-theme.dark-mode",
      "styles",
    ]);
  });

  it("types colours, dimensions, weights, numbers and font families from the variable's type and scopes", () => {
    const { orbit } = dtcgTrees(RAW).trees as Record<string, Record<string, Record<string, unknown>>>;

    expect(orbit?.color?.veil).toEqual({
      $type: "color",
      $value: {
        colorSpace: "srgb",
        components: [0, 0, 0],
        alpha: 0.5,
        hex: "#000000",
      },
    });
    expect(orbit?.space).toEqual({
      16: {
        $type: "dimension",
        $value: {
          value: 16,
          unit: "px",
        },
      },
      "1-5": {
        $type: "dimension",
        $value: {
          value: 6,
          unit: "px",
        },
      },
    });
    expect(orbit?.font).toEqual({
      weight: {
        bold: {
          $type: "fontWeight",
          $value: 700,
        },
      },
      family: {
        $type: "fontFamily",
        $value: "Inter",
      },
    });
    expect(orbit?.ratio).toEqual({
      $type: "number",
      $value: 1.5,
    });
  });

  it("keeps a token whose path is also a group as the group's $root, and refers to it there", () => {
    const { trees } = dtcgTrees(RAW);

    expect((trees.orbit as Record<string, Record<string, unknown>>).color?.brand).toEqual({
      $root: {
        $type: "color",
        $value: BRAND,
        $description: "The one accent.",
      },
      hover: {
        $type: "color",
        $value: {
          colorSpace: "srgb",
          components: [0.1647, 0.1255, 0.7216],
          hex: "#2A20B8",
        },
      },
    });
    expect(trees["brand-theme.dark-mode"]).toEqual({
      surface: {
        $type: "color",
        $value: "{color.brand.$root}",
      },
      accent: {
        $type: "color",
        $value: "{color.brand.hover}",
      },
    });
  });

  it("refers to a library's variable by its name's path", () => {
    expect((dtcgTrees(RAW).trees["brand-theme.light"] as Record<string, unknown>).accent).toEqual({
      $type: "color",
      $value: "{Accent.Primary}",
    });
  });

  it("writes paint, text and effect styles as color, gradient, typography and shadow tokens", () => {
    const styles = dtcgTrees(RAW).trees.styles as Record<string, Record<string, unknown>>;

    expect(styles.Brand?.Primary).toEqual({
      $type: "color",
      $value: BRAND,
    });
    expect(styles["Hero gradient"]).toEqual({
      $type: "gradient",
      $value: [
        {
          color: BRAND,
          position: 0,
        },
        {
          color: {
            colorSpace: "srgb",
            components: [0.5451, 0.3608, 0.9647],
            hex: "#8B5CF6",
          },
          position: 1,
        },
      ],
    });
    expect(styles.Heading?.H3).toEqual({
      $type: "typography",
      $value: {
        fontFamily: "Space Grotesk",
        fontSize: {
          value: 24,
          unit: "px",
        },
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: {
          value: -0.24,
          unit: "px",
        },
      },
    });
    expect((styles.Shadow as Record<string, unknown>).Card).toEqual({
      $type: "shadow",
      $value: {
        color: {
          colorSpace: "srgb",
          components: [0.078, 0.086, 0.122],
          alpha: 0.12,
          hex: "#14161F",
        },
        offsetX: {
          value: 0,
          unit: "px",
        },
        offsetY: {
          value: 12,
          unit: "px",
        },
        blur: {
          value: 32,
          unit: "px",
        },
        spread: {
          value: -8,
          unit: "px",
        },
      },
    });
    expect(((styles.Shadow as Record<string, { $value: unknown[] }>).Well?.$value ?? [])[0]).toMatchObject({
      inset: true,
    });
  });

  it("names what DTCG has no type for instead of dropping it silently", () => {
    const { trees, notes } = dtcgTrees(RAW);
    const text = notes.join("\n");

    expect(JSON.stringify(trees)).not.toContain("Buy");
    expect(text).toMatch(/copy\/label/);
    expect(text).toMatch(/flag\/beta/);
    expect(text).toMatch(/Photo/);
    expect(text).toMatch(/Glass/);
    expect(text).toMatch(/Body.*Auto line height.*1\.2/);
  });

  it("names an alias to a variable it cannot find, and leaves that token out", () => {
    const { trees, notes } = dtcgTrees({
      ...RAW,
      variables: [
        variable({
          id: "V:lost",
          name: "lost",
          valuesByMode: {
            "M:o": {
              type: "VARIABLE_ALIAS",
              id: "V:gone",
            },
          },
        }),
      ],
    });

    expect(trees.orbit).toEqual({});
    expect(notes.join("\n")).toMatch(/lost points at a variable that is neither in this file nor in a library it uses/);
  });

  it("keeps only the collections asked for, styles included", () => {
    expect(Object.keys(dtcgTrees(RAW, { collections: ["brand theme"] }).trees)).toEqual([
      "brand-theme.light",
      "brand-theme.dark-mode",
      "styles",
    ]);
  });
});

const alias = (id: string) => ({
  type: "VARIABLE_ALIAS",
  id,
});

describe("DTCG references", () => {
  it("types a token by the tokens that point at it, so no alias dangles or loses its unit", () => {
    const { trees, notes } = dtcgTrees({
      ...RAW,
      variables: [
        variable({
          id: "V:sans",
          name: "font/sans",
          resolvedType: "STRING",
          valuesByMode: { "M:o": "Inter" },
        }),
        variable({
          id: "V:family",
          name: "heading/family",
          resolvedType: "STRING",
          scopes: ["FONT_FAMILY"],
          valuesByMode: { "M:o": alias("V:sans") },
        }),
        variable({
          id: "V:4",
          name: "space/4",
          resolvedType: "FLOAT",
          valuesByMode: { "M:o": 16 },
        }),
        variable({
          id: "V:md",
          name: "gap/md",
          resolvedType: "FLOAT",
          scopes: ["GAP"],
          valuesByMode: { "M:o": alias("V:4") },
        }),
      ],
      styles: [],
    });

    expect(trees.orbit).toEqual({
      font: {
        sans: {
          $type: "fontFamily",
          $value: "Inter",
        },
      },
      heading: {
        family: {
          $type: "fontFamily",
          $value: "{font.sans}",
        },
      },
      space: {
        4: {
          $type: "dimension",
          $value: {
            value: 16,
            unit: "px",
          },
        },
      },
      gap: {
        md: {
          $type: "dimension",
          $value: "{space.4}",
        },
      },
    });
    expect(notes.join("\n")).not.toMatch(/font\/sans/);
  });

  it("names an alias to a token no tree here holds: a library's, or one in a collection left out", () => {
    expect(dtcgTrees(RAW).notes.join("\n")).toMatch(
      /accent points at Accent\/Primary from a library \(Core\): no file here defines it/,
    );
    expect(dtcgTrees(RAW, { collections: ["brand theme"] }).notes.join("\n")).toMatch(
      /surface points at color\/brand in Orbit, which this output leaves out/,
    );
  });

  it("never lets one token overwrite another: a collection named Styles, same-named styles, names alike once cleaned", () => {
    const { trees, notes } = dtcgTrees({
      ...RAW,
      collections: [
        ...RAW.collections,
        {
          id: "C:styles",
          name: "Styles",
          remote: false,
          defaultModeId: "M:s",
          modes: [
            {
              modeId: "M:s",
              name: "Default",
            },
          ],
        },
      ],
      variables: [
        variable({
          id: "V:dot",
          name: "brand.primary",
          valuesByMode: { "M:o": rgb(255, 0, 0) },
        }),
        variable({
          id: "V:dash",
          name: "brand-primary",
          valuesByMode: { "M:o": rgb(0, 0, 255) },
        }),
        variable({
          id: "V:link",
          name: "link",
          valuesByMode: { "M:o": alias("V:dash") },
        }),
        variable({
          id: "V:ink",
          name: "ink",
          collectionId: "C:styles",
          valuesByMode: { "M:s": rgb(0, 0, 0) },
        }),
      ],
      styles: [
        style({
          id: "S:local",
          name: "Brand/Primary",
          type: "PAINT",
          paints: [
            {
              type: "SOLID",
              visible: true,
              color: rgb(59, 47, 217),
            },
          ],
        }),
        style({
          id: "S:library",
          name: "Brand/Primary",
          type: "PAINT",
          remote: true,
          paints: [
            {
              type: "SOLID",
              visible: true,
              color: rgb(0, 0, 0),
            },
          ],
        }),
      ],
    });
    const orbit = trees.orbit as Record<string, { $value: unknown }>;
    const text = notes.join("\n");

    expect(Object.keys(trees)).toEqual(["orbit", "brand-theme.light", "brand-theme.dark-mode", "styles-2", "styles"]);
    expect((trees["styles-2"] as Record<string, unknown>).ink).toBeDefined();
    expect(Object.keys(orbit)).toEqual(["brand-primary", "brand-primary-2", "link"]);
    expect(orbit.link?.$value).toBe("{brand-primary-2}");
    expect(Object.keys((trees.styles as Record<string, Record<string, unknown>>).Brand ?? {})).toEqual([
      "Primary",
      "Primary-2",
    ]);
    expect(text).toMatch(/The collection Styles is written as styles-2/);
    expect(text).toMatch(/brand-primary has the same DTCG path as another token: written as brand-primary-2/);
    expect(text).toMatch(/Brand\/Primary has the same DTCG path as another token: written as Brand\.Primary-2/);
  });
});
