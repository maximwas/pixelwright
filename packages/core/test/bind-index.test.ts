import { describe, expect, it } from "vitest";
import { BindIndex, effectsValue, type RawTokens, textValue } from "../src/index.ts";

const rgba = (hex: number, a = 1) => ({
  r: ((hex >> 16) & 255) / 255,
  g: ((hex >> 8) & 255) / 255,
  b: (hex & 255) / 255,
  a,
});

const variable = (id: string, name: string, values: Record<string, unknown>, extra: Partial<RawVariable> = {}) => ({
  id,
  name,
  collectionId: "C:theme",
  resolvedType: typeof Object.values(values)[0] === "number" ? "FLOAT" : "COLOR",
  scopes: ["ALL_SCOPES"],
  valuesByMode: values,
  ...extra,
});

type RawVariable = RawTokens["variables"][number];

const INTER = {
  fontName: {
    family: "Inter",
    style: "Semi Bold",
  },
  fontSize: 16,
  lineHeight: {
    unit: "PIXELS",
    value: 24,
  },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
};

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  color: rgba(0x000000, 0.2),
  offset: {
    x: 0,
    y: 4,
  },
  radius: 12,
  spread: 0,
};

/** A file with a light and a dark mode, a brand colour two tokens hold, spacing, and styles of every kind. */
const RAW: RawTokens = {
  collections: [
    {
      id: "C:theme",
      name: "Theme",
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
  ],
  variables: [
    variable("V:surface", "surface", {
      "M:light": rgba(0xffffff),
      "M:dark": rgba(0x14161f),
    }),
    variable("V:brand", "brand/500", {
      "M:light": rgba(0x3b2fd9),
      "M:dark": rgba(0x3b2fd9),
    }),
    variable("V:accent", "accent", {
      "M:light": {
        type: "VARIABLE_ALIAS",
        id: "V:brand",
      },
      "M:dark": {
        type: "VARIABLE_ALIAS",
        id: "V:brand",
      },
    }),
    variable(
      "V:ink",
      "ink",
      {
        "M:light": rgba(0x14161f),
        "M:dark": rgba(0xffffff),
      },
      { scopes: ["TEXT_FILL"] },
    ),
    variable("V:line", "line", {
      "M:light": rgba(0x173126, 0.14),
      "M:dark": rgba(0x173126, 0.14),
    }),
    variable(
      "V:space-4",
      "space/4",
      {
        "M:light": 16,
        "M:dark": 16,
      },
      { scopes: ["GAP"] },
    ),
    variable(
      "V:radius-m",
      "radius/m",
      {
        "M:light": 16,
        "M:dark": 16,
      },
      { scopes: ["CORNER_RADIUS"] },
    ),
  ],
  external: {},
  styles: [
    {
      id: "S:paper",
      name: "Paper",
      type: "PAINT",
      remote: false,
      paints: [
        {
          type: "SOLID",
          visible: true,
          color: rgba(0xffffff),
        },
      ],
    },
    {
      id: "S:brand",
      name: "Brand",
      type: "PAINT",
      remote: false,
      paints: [
        {
          type: "SOLID",
          visible: true,
          color: rgba(0x3b2fd9),
          boundVariables: {
            color: {
              type: "VARIABLE_ALIAS",
              id: "V:brand",
            },
          },
        },
      ],
    },
    {
      id: "S:label",
      name: "Label",
      type: "TEXT",
      remote: false,
      ...INTER,
    },
    {
      id: "S:card",
      name: "Card shadow",
      type: "EFFECT",
      remote: false,
      effects: [SHADOW],
    },
  ],
};

const LIGHT = { "C:theme": "M:light" };
const DARK = { "C:theme": "M:dark" };

const tokens = (candidates: readonly { token: string }[]) => candidates.map(({ token }) => token);

describe("BindIndex: the tokens that hold a value", () => {
  const index = BindIndex.of(RAW);

  it("finds the colour variables and paint styles holding a colour in the layer's mode", () => {
    expect(
      tokens(
        index.colors("#FFF", {
          scope: "FRAME_FILL",
          modes: LIGHT,
          stylable: true,
        }),
      ),
    ).toEqual(["--surface", "--Paper"]);
    expect(
      tokens(
        index.colors("#FFF", {
          scope: "FRAME_FILL",
          modes: DARK,
          stylable: true,
        }),
      ),
    ).toEqual(["--Paper"]);
    expect(
      tokens(
        index.colors("#14161F", {
          scope: "FRAME_FILL",
          modes: DARK,
          stylable: true,
        }),
      ),
    ).toEqual(["--surface"]);
  });

  it("keeps a variable's scopes: a text colour is no frame fill", () => {
    expect(
      tokens(
        index.colors("#14161F", {
          scope: "TEXT_FILL",
          modes: LIGHT,
          stylable: true,
        }),
      ),
    ).toEqual(["--ink"]);
    expect(
      index.colors("#14161F", {
        scope: "FRAME_FILL",
        modes: LIGHT,
        stylable: true,
      }),
    ).toEqual([]);
  });

  it("follows aliases and prefers them to what they point at, a style wrapping a match counted as that match", () => {
    expect(
      tokens(
        index.colors("#3B2FD9", {
          scope: "SHAPE_FILL",
          modes: LIGHT,
          stylable: true,
        }),
      ),
    ).toEqual(["--accent"]);
  });

  it("matches a see-through colour with its alpha, and leaves paint styles out of a layer with several paints", () => {
    expect(
      tokens(
        index.colors("rgba(23, 49, 38, 0.14)", {
          scope: "STROKE_COLOR",
          modes: LIGHT,
          stylable: true,
        }),
      ),
    ).toEqual(["--line"]);
    expect(
      tokens(
        index.colors("#FFF", {
          scope: "FRAME_FILL",
          modes: LIGHT,
          stylable: false,
        }),
      ),
    ).toEqual(["--surface"]);
  });

  it("finds number variables by value within their scopes", () => {
    expect(
      tokens(
        index.numbers(16, {
          scope: "GAP",
          modes: LIGHT,
        }),
      ),
    ).toEqual(["--space-4"]);
    expect(
      tokens(
        index.numbers(16, {
          scope: "CORNER_RADIUS",
          modes: LIGHT,
        }),
      ),
    ).toEqual(["--radius-m"]);
    expect(
      index.numbers(15, {
        scope: "GAP",
        modes: LIGHT,
      }),
    ).toEqual([]);
  });

  it("finds text and effect styles by the value design_read writes", () => {
    expect(tokens(index.texts(textValue(INTER)))).toEqual(["--Label-font"]);
    expect(tokens(index.effects(effectsValue([SHADOW]) ?? ""))).toEqual(["--Card-shadow"]);
    expect(textValue(INTER)).toBe("600 16px/24px 'Inter'");
    expect(effectsValue([SHADOW])).toBe("box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.2)");
  });

  it("names a token's style or variable, a text style by its token or its name", () => {
    expect(index.byToken("--brand-500").map(({ id }) => id)).toEqual(["V:brand"]);
    expect(index.byToken("--Label-font").map(({ id }) => id)).toEqual(["S:label"]);
    expect(index.byToken("Label").map(({ id }) => id)).toEqual(["S:label"]);
    expect(index.byToken("--nothing")).toEqual([]);
  });

  it("gives a token's value in the layer's mode, to tell an exact match from a snapped one", () => {
    const [surface] = index.byToken("--surface");

    expect(surface === undefined ? null : index.valueOf(surface, DARK)).toBe("#14161F");
    expect(surface === undefined ? null : index.valueOf(surface, LIGHT)).toBe("#FFF");
  });
});
