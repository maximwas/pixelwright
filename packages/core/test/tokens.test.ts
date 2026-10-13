import { describe, expect, it } from "vitest";
import { type RawTokens, tokenModel, tokensCss } from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

const WHITE = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
};
const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
  a: 1,
};

const variable = (
  fields: Partial<RawTokens["variables"][number]> & { id: string; name: string; valuesByMode: Record<string, unknown> },
) => ({
  collectionId: "C:brand",
  resolvedType: "COLOR",
  scopes: ["ALL_SCOPES"],
  ...fields,
});

const RAW: RawTokens = {
  collections: [
    {
      id: "C:brand",
      name: "Brand",
      remote: false,
      defaultModeId: "M:light",
      modes: [
        {
          modeId: "M:light",
          name: "Light",
        },
        {
          modeId: "M:dark",
          name: "Dark",
        },
      ],
    },
    {
      id: "C:space",
      name: "Spacing",
      remote: false,
      defaultModeId: "M:base",
      modes: [
        {
          modeId: "M:base",
          name: "Base",
        },
      ],
    },
  ],
  variables: [
    variable({
      id: "V:surface",
      name: "Surface",
      codeSyntax: { WEB: "var(--surface)" },
      valuesByMode: {
        "M:light": WHITE,
        "M:dark": {
          type: "VARIABLE_ALIAS",
          id: "V:ink",
        },
      },
    }),
    variable({
      id: "V:ink",
      name: "Ink",
      valuesByMode: {
        "M:light": DARK,
        "M:dark": {
          type: "VARIABLE_ALIAS",
          id: "V:lib-accent",
        },
      },
    }),
    variable({
      id: "V:gap",
      name: "space/4",
      collectionId: "C:space",
      resolvedType: "FLOAT",
      scopes: ["GAP"],
      valuesByMode: { "M:base": 16 },
    }),
  ],
  external: {
    "V:lib-accent": {
      name: "Accent",
      collection: "Core",
      resolvedType: "COLOR",
    },
  },
  styles: [],
};

describe("token model", () => {
  it("names every variable like design_read does and writes each mode's value, aliases as var()", () => {
    const model = tokenModel(RAW);

    expect(model.collections[0]).toEqual({
      name: "Brand",
      modes: ["Light", "Dark"],
      defaultMode: "Light",
      selectors: { Dark: '[data-brand="dark"]' },
      variables: [
        {
          name: "Surface",
          token: "--surface",
          type: "COLOR",
          values: {
            Light: "#FFF",
            Dark: "var(--Ink)",
          },
        },
        {
          name: "Ink",
          token: "--Ink",
          type: "COLOR",
          values: {
            Light: "#191A23",
            Dark: "var(--Accent)",
          },
        },
      ],
    });
    expect(model.collections[1]?.variables).toEqual([
      {
        name: "space/4",
        token: "--space-4",
        type: "FLOAT",
        values: { Base: "16px" },
      },
    ]);
  });

  it("writes the default modes in :root and every other mode as its own block", () => {
    const css = tokensCss(tokenModel(RAW));

    expect(css).toContain(
      ":root {\n  /* Brand */\n  --surface: #FFF;\n  --Ink: #191A23;\n  /* Spacing */\n  --space-4: 16px;\n}",
    );
    expect(css).toContain('[data-brand="dark"] {\n  --surface: var(--Ink);\n  --Ink: var(--Accent);\n}');
  });

  it("keeps a big system's modes apart and lets a filter keep only the collections asked for", () => {
    const modes = ["Light", "Dark", "Contrast"].map((name) => ({
      modeId: `M:${name}`,
      name,
    }));
    const raw: RawTokens = {
      collections: [
        {
          id: "C:ds",
          name: "Design System",
          remote: false,
          defaultModeId: "M:Light",
          modes,
        },
        ...RAW.collections,
      ],
      variables: [
        ...Array.from({ length: 600 }, (_, index) =>
          variable({
            id: `V:${index}`,
            name: `color/${index}`,
            collectionId: "C:ds",
            valuesByMode: Object.fromEntries(modes.map(({ modeId }) => [modeId, index % 2 === 0 ? WHITE : DARK])),
          }),
        ),
        ...RAW.variables,
      ],
      external: RAW.external,
      styles: [],
    };
    const css = tokensCss(tokenModel(raw));

    expect(css.match(/^\[data-design-system="(dark|contrast)"\] \{$/gm)).toEqual([
      '[data-design-system="dark"] {',
      '[data-design-system="contrast"] {',
    ]);
    expect(css.match(/--color-\d+:/g)).toHaveLength(1_800);

    const spacing = tokensCss(tokenModel(raw, { collections: ["spacing"] }));

    expect(spacing).toContain("--space-4: 16px;");
    expect(spacing).not.toContain("--color-0");
  });

  it("writes every type of value with its unit, and says what CSS cannot hold", () => {
    const model = tokenModel({
      collections: [RAW.collections[1] as RawTokens["collections"][number]],
      variables: [
        variable({
          id: "V:1",
          name: "opacity/muted",
          collectionId: "C:space",
          resolvedType: "FLOAT",
          scopes: ["OPACITY"],
          valuesByMode: { "M:base": 0.5 },
        }),
        variable({
          id: "V:2",
          name: "radius/s",
          collectionId: "C:space",
          resolvedType: "FLOAT",
          scopes: ["CORNER_RADIUS"],
          valuesByMode: { "M:base": 4.5 },
        }),
        variable({
          id: "V:3",
          name: "font/body",
          collectionId: "C:space",
          resolvedType: "STRING",
          scopes: ["FONT_FAMILY"],
          valuesByMode: { "M:base": "Space Grotesk" },
        }),
        variable({
          id: "V:4",
          name: "flag/beta",
          collectionId: "C:space",
          resolvedType: "BOOLEAN",
          valuesByMode: { "M:base": true },
        }),
        variable({
          id: "V:5",
          name: "ease/standard",
          collectionId: "C:space",
          resolvedType: "EASING",
          valuesByMode: {
            "M:base": {
              type: "CUSTOM_CUBIC_BEZIER",
              easingFunctionCubicBezier: {
                x1: 0.2,
                y1: 0,
                x2: 0,
                y2: 1,
              },
            },
          },
        }),
        variable({
          id: "V:6",
          name: "time/fast",
          collectionId: "C:space",
          resolvedType: "TIMING",
          valuesByMode: { "M:base": 0.15 },
        }),
        variable({
          id: "V:7",
          name: "ink/muted",
          collectionId: "C:space",
          valuesByMode: {
            "M:base": {
              color: {
                type: "VARIABLE_ALIAS",
                id: "V:ink",
              },
              opacity: 0.6,
            },
          },
        }),
        variable({
          id: "V:8",
          name: "ghost",
          collectionId: "C:space",
          valuesByMode: {
            "M:base": {
              type: "VARIABLE_ALIAS",
              id: "V:missing",
            },
          },
        }),
      ],
      external: {
        "V:ink": {
          name: "Ink",
          collection: "Brand",
          resolvedType: "COLOR",
        },
      },
      styles: [],
    });
    const values = Object.fromEntries(
      model.collections[0]?.variables.map((entry) => [entry.name, entry.values.Base]) ?? [],
    );

    expect(values).toEqual({
      "opacity/muted": "0.5",
      "radius/s": "4.5px",
      "font/body": "'Space Grotesk'",
      "flag/beta": "true",
      "ease/standard": "cubic-bezier(0.2, 0, 0, 1)",
      "time/fast": "0.15s",
      "ink/muted": "color-mix(in srgb, var(--Ink) 60%, transparent)",
      ghost: "/* unresolved alias V:missing */",
    });
    expect(model.notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/flag\/beta.*boolean/i),
        expect.stringMatching(/ghost.*V:missing/),
      ]),
    );
  });

  it("adds the file's styles as tokens named like design_read's", () => {
    const plans = fixture("orbit-plans");
    const model = tokenModel({
      collections: [],
      variables: [],
      external: {},
      styles: Object.entries(plans.styles).map(([id, style]) => ({
        id,
        ...style,
      })),
    });
    const css = tokensCss(model);

    expect(model.styles.text).toContainEqual({
      name: "Heading/H3",
      token: "--Heading-H3-font",
      value: "500 24px/30px 'Space Grotesk'",
      also: [
        {
          token: "--Heading-H3-letter-spacing",
          value: "-0.01em",
        },
      ],
    });
    expect(model.styles.effect).toContainEqual({
      name: "Shadow/Card",
      token: "--Shadow-Card",
      value: "0 12px 32px -8px rgba(20, 22, 31, 0.12)",
    });
    expect(css).toContain("--Heading-H3-font: 500 24px/30px 'Space Grotesk';");
    expect(css).toContain("--Shadow-Card: 0 12px 32px -8px rgba(20, 22, 31, 0.12);");
  });
});

describe("stage-3 review fixes in the token model", () => {
  it("keeps Cyrillic collection and mode names apart in the mode selectors, and splits colliding ones", () => {
    const raw: RawTokens = {
      collections: [
        {
          id: "C:ua",
          name: "Кольори",
          remote: false,
          defaultModeId: "M:1",
          modes: [
            {
              modeId: "M:1",
              name: "Світла",
            },
            {
              modeId: "M:2",
              name: "Темна",
            },
            {
              modeId: "M:3",
              name: "Контраст",
            },
            {
              modeId: "M:4",
              name: "контраст ",
            },
          ],
        },
      ],
      variables: [
        variable({
          id: "V:1",
          name: "Фон",
          collectionId: "C:ua",
          valuesByMode: {
            "M:1": WHITE,
            "M:2": DARK,
            "M:3": DARK,
            "M:4": WHITE,
          },
        }),
      ],
      external: {},
      styles: [],
    };
    const model = tokenModel(raw);
    const css = tokensCss(model);

    expect(css.match(/^\[data-[^\]]+\] \{$/gm)).toEqual([
      '[data-кольори="темна"] {',
      '[data-кольори="контраст"] {',
      '[data-кольори="контраст-2"] {',
    ]);
    expect(model.notes).toContainEqual(expect.stringMatching(/контраст.*контраст-2/));
  });

  it("says when an alias points at a token the output leaves out, and which collection holds it", () => {
    const raw: RawTokens = {
      collections: [
        {
          id: "C:prim",
          name: "Primitives",
          remote: false,
          defaultModeId: "M:p",
          modes: [
            {
              modeId: "M:p",
              name: "Value",
            },
          ],
        },
        {
          id: "C:sem",
          name: "Semantic",
          remote: false,
          defaultModeId: "M:s",
          modes: [
            {
              modeId: "M:s",
              name: "Light",
            },
          ],
        },
      ],
      variables: [
        variable({
          id: "V:gray",
          name: "gray/900",
          collectionId: "C:prim",
          valuesByMode: { "M:p": DARK },
        }),
        variable({
          id: "V:bg",
          name: "bg",
          collectionId: "C:sem",
          valuesByMode: {
            "M:s": {
              type: "VARIABLE_ALIAS",
              id: "V:gray",
            },
          },
        }),
      ],
      external: {},
      styles: [],
    };
    const model = tokenModel(raw, { collections: ["Semantic"] });

    expect(model.collections[0]?.variables[0]?.values).toEqual({ Light: "var(--gray-900)" });
    expect(model.notes).toContainEqual(expect.stringMatching(/--gray-900.*Primitives/));
  });

  it("reads a composed colour's opacity and an opacity variable as percents when Figma gives them so", () => {
    const model = tokenModel({
      collections: [RAW.collections[1] as RawTokens["collections"][number]],
      variables: [
        variable({
          id: "V:o",
          name: "muted",
          collectionId: "C:space",
          resolvedType: "FLOAT",
          scopes: ["OPACITY"],
          valuesByMode: { "M:base": 40 },
        }),
        variable({
          id: "V:f",
          name: "faint",
          collectionId: "C:space",
          resolvedType: "FLOAT",
          scopes: ["OPACITY"],
          valuesByMode: { "M:base": 0.4 },
        }),
        variable({
          id: "V:c",
          name: "ink/50",
          collectionId: "C:space",
          valuesByMode: {
            "M:base": {
              color: {
                type: "VARIABLE_ALIAS",
                id: "V:ink",
              },
              opacity: 50,
            },
          },
        }),
      ],
      external: {
        "V:ink": {
          name: "Ink",
          collection: "Brand",
          resolvedType: "COLOR",
        },
      },
      styles: [],
    });

    expect(model.collections[0]?.variables.map((entry) => entry.values.Base)).toEqual([
      "0.4",
      "0.4",
      "color-mix(in srgb, var(--Ink) 50%, transparent)",
    ]);
  });
});
