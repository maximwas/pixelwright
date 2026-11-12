import { type RawTokens, RawTokensSchema } from "../../src/index.ts";

const alias = (id: string) => ({
  type: "VARIABLE_ALIAS",
  id,
});

const rgb = (r: number, g: number, b: number, a = 1) => ({
  r,
  g,
  b,
  a,
});

/**
 * Tokens that take every path the token outputs have: each variable type and value form (a colour with and without
 * alpha, a composed colour, aliases inside the file, to a library and to nothing), number scopes, easings, timing,
 * a code syntax and a description; solid, faded, gradient and same-named paint styles, text styles with extras, an
 * effect style with shadows and a blur, and one with a blur only.
 */
export function goldenTokens(colorProfile?: string): RawTokens {
  return RawTokensSchema.parse({
    collections: [
      {
        id: "C:brand",
        name: "Brand Colors",
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
          {
            modeId: "M:dim",
            name: "dark",
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
      {
        id: "C:motion",
        name: "Motion",
        remote: false,
        defaultModeId: "M:motion",
        modes: [
          {
            modeId: "M:motion",
            name: "Default",
          },
        ],
      },
    ],
    variables: [
      {
        id: "V:surface",
        name: "Surface/Base",
        collectionId: "C:brand",
        resolvedType: "COLOR",
        description: "The page background.",
        scopes: ["FRAME_FILL", "SHAPE_FILL"],
        codeSyntax: { WEB: "var(--surface)" },
        valuesByMode: {
          "M:light": rgb(1, 1, 1),
          "M:dark": alias("V:ink"),
          "M:dim": rgb(0.1, 0.1, 0.12),
        },
      },
      {
        id: "V:ink",
        name: "Ink",
        collectionId: "C:brand",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: {
          "M:light": rgb(0.078, 0.086, 0.122),
          "M:dark": alias("V:lib-accent"),
          "M:dim": rgb(0.9, 0.2, 0.35, 0.5),
        },
      },
      {
        id: "V:veil",
        name: "Veil",
        collectionId: "C:brand",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: {
          "M:light": {
            color: rgb(0, 0, 0),
            opacity: 0.4,
          },
          "M:dark": {
            color: alias("V:ink"),
            opacity: 64,
          },
          "M:dim": {
            color: rgb(1, 1, 1),
            opacity: alias("V:half"),
          },
        },
      },
      {
        id: "V:lost",
        name: "Lost",
        collectionId: "C:brand",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: {
          "M:light": alias("V:missing"),
          "M:dark": rgb(0.5, 0.5, 0.5),
          "M:dim": "not a colour",
        },
      },
      {
        id: "V:gap",
        name: "Gap/Small",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: ["GAP"],
        valuesByMode: { "M:base": 8 },
      },
      {
        id: "V:zero",
        name: "Gap/None",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: ["GAP"],
        valuesByMode: { "M:base": 0 },
      },
      {
        id: "V:radius",
        name: "Radius",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: [],
        valuesByMode: { "M:base": 13.5 },
      },
      {
        id: "V:half",
        name: "Opacity/Half",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: ["OPACITY"],
        valuesByMode: { "M:base": 50 },
      },
      {
        id: "V:faint",
        name: "Opacity/Faint",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: ["COLOR_OPACITY"],
        valuesByMode: { "M:base": 0.25 },
      },
      {
        id: "V:bold",
        name: "Weight/Bold",
        collectionId: "C:space",
        resolvedType: "FLOAT",
        scopes: ["FONT_WEIGHT"],
        valuesByMode: { "M:base": 700 },
      },
      {
        id: "V:family",
        name: "Font/Family",
        collectionId: "C:space",
        resolvedType: "STRING",
        scopes: ["FONT_FAMILY"],
        valuesByMode: { "M:base": "Inter 'Display' \\ Pro" },
      },
      {
        id: "V:flag",
        name: "Feature/On",
        collectionId: "C:space",
        resolvedType: "BOOLEAN",
        scopes: ["ALL_SCOPES"],
        valuesByMode: { "M:base": true },
      },
      {
        id: "V:ease",
        name: "Ease/Out",
        collectionId: "C:motion",
        resolvedType: "EASING",
        scopes: [],
        valuesByMode: { "M:motion": { type: "EASE_OUT" } },
      },
      {
        id: "V:curve",
        name: "Ease/Curve",
        collectionId: "C:motion",
        resolvedType: "EASING",
        scopes: [],
        valuesByMode: {
          "M:motion": {
            type: "CUSTOM_CUBIC_BEZIER",
            easingFunctionCubicBezier: {
              x1: 0.2,
              y1: 0,
              x2: 0,
              y2: 1,
            },
          },
        },
      },
      {
        id: "V:spring",
        name: "Ease/Spring",
        collectionId: "C:motion",
        resolvedType: "EASING",
        scopes: [],
        valuesByMode: { "M:motion": { type: "GENTLE" } },
      },
      {
        id: "V:duration",
        name: "Duration",
        collectionId: "C:motion",
        resolvedType: "TIMING",
        scopes: [],
        valuesByMode: { "M:motion": 0.3 },
      },
    ],
    external: {
      "V:lib-accent": {
        name: "Accent",
        collection: "Library Colors",
        resolvedType: "COLOR",
      },
    },
    styles: [
      {
        id: "S:white",
        name: "White",
        type: "PAINT",
        remote: false,
        paints: [
          {
            type: "SOLID",
            visible: true,
            opacity: 1,
            blendMode: "NORMAL",
            color: rgb(1, 1, 1),
          },
        ],
      },
      {
        id: "S:white-2",
        name: "White",
        type: "PAINT",
        remote: true,
        duplicate: 2,
        paints: [
          {
            type: "SOLID",
            visible: true,
            opacity: 0.8,
            blendMode: "NORMAL",
            color: rgb(0.98, 0.98, 0.98),
          },
        ],
      },
      {
        id: "S:glow",
        name: "Glow",
        type: "PAINT",
        remote: false,
        css: "linear-gradient(90deg, #FFF 0%, #000 100%)",
        paints: [
          {
            type: "GRADIENT_LINEAR",
            visible: true,
            opacity: 1,
            blendMode: "NORMAL",
          },
        ],
      },
      {
        id: "S:photo",
        name: "Photo",
        type: "PAINT",
        remote: false,
        paints: [
          {
            type: "IMAGE",
            visible: true,
            opacity: 1,
            blendMode: "NORMAL",
          },
        ],
      },
      {
        id: "S:h1",
        name: "Heading/H1",
        type: "TEXT",
        remote: false,
        fontName: {
          family: "Inter",
          style: "Bold Italic",
        },
        fontSize: 48,
        lineHeight: {
          unit: "PERCENT",
          value: 120,
        },
        letterSpacing: {
          unit: "PERCENT",
          value: -2,
        },
        textCase: "UPPER",
        textDecoration: "NONE",
      },
      {
        id: "S:body",
        name: "Body",
        type: "TEXT",
        remote: false,
        fontName: {
          family: "Open Sans",
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
      {
        id: "S:card",
        name: "Shadow/Card",
        type: "EFFECT",
        remote: false,
        effects: [
          {
            type: "DROP_SHADOW",
            visible: true,
            radius: 24,
            spread: 0,
            offset: {
              x: 0,
              y: 8,
            },
            color: rgb(0, 0, 0, 0.12),
            blendMode: "NORMAL",
          },
          {
            type: "INNER_SHADOW",
            visible: true,
            radius: 2,
            spread: 1,
            offset: {
              x: 0,
              y: 1,
            },
            color: rgb(1, 1, 1, 0.5),
            blendMode: "NORMAL",
          },
          {
            type: "LAYER_BLUR",
            visible: true,
            radius: 4,
          },
        ],
      },
      {
        id: "S:frost",
        name: "Frost",
        type: "EFFECT",
        remote: false,
        effects: [
          {
            type: "BACKGROUND_BLUR",
            visible: true,
            radius: 12,
          },
        ],
      },
    ],
    ...(colorProfile === undefined ? {} : { colorProfile }),
  });
}
