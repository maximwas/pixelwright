import { describe, expect, it } from "vitest";
import {
  type RawTokens,
  scopesError,
  type TokenModel,
  TokensApplyInputSchema,
  tokenModel,
  tokensPlan,
} from "../src/index.ts";

const COLLECTION = {
  id: "C:1",
  name: "Tokens",
  remote: false,
  defaultModeId: "M:1",
  modes: [
    {
      modeId: "M:1",
      name: "Base",
    },
  ],
};

type RawVariable = RawTokens["variables"][number];

const number = (id: string, name: string, scopes: string[], value: unknown, more: Partial<RawVariable> = {}) => ({
  id,
  name,
  collectionId: "C:1",
  resolvedType: "FLOAT",
  scopes,
  valuesByMode: { "M:1": value },
  ...more,
});

const alias = (id: string) => ({
  type: "VARIABLE_ALIAS",
  id,
});

const read = (variables: RawVariable[]) =>
  tokenModel({
    collections: [COLLECTION],
    variables,
    external: {},
    styles: [],
  });

const valuesOf = (model: TokenModel) =>
  Object.fromEntries((model.collections[0]?.variables ?? []).map((variable) => [variable.name, variable.values.Base]));

describe("tokens_read: a number's unit", () => {
  it("writes a primitive without px when the tokens pointing at it are font weights or opacities", () => {
    const model = read([
      number("V:700", "weight/700", [], 700),
      number("V:bold", "font-weight/bold", ["FONT_WEIGHT"], alias("V:700")),
      number("V:40", "opacity/40", ["ALL_SCOPES"], 40),
      number("V:muted", "opacity/muted", ["OPACITY"], alias("V:40")),
      number("V:8", "space/8", [], 8),
      number("V:gap", "gap/s", ["GAP"], alias("V:8")),
      number("V:lone", "lone", [], 12),
      number("V:count", "count", ["TEXT_CONTENT"], 3),
    ]);

    expect(valuesOf(model)).toEqual({
      "weight/700": "700",
      "font-weight/bold": "var(--weight-700)",
      "opacity/40": "0.4",
      "opacity/muted": "var(--opacity-40)",
      "space/8": "8px",
      "gap/s": "var(--space-8)",
      lone: "12px",
      count: "3",
    });
  });

  it("keeps px for a primitive that a length and a font weight both point at", () => {
    const model = read([
      number("V:4", "four", [], 4),
      number("V:gap", "gap", ["GAP"], alias("V:4")),
      number("V:weight", "weight", ["FONT_WEIGHT"], alias("V:4")),
    ]);

    expect(valuesOf(model).four).toBe("4px");
  });
});

describe("tokens_read json: scopes and code syntax", () => {
  it("lists scopes other than every field, and the code syntax, for tokens_apply to write back", () => {
    const model = read([
      number("V:700", "weight/700", [], 700),
      number("V:bold", "font-weight/bold", ["FONT_WEIGHT"], 600, {
        codeSyntax: {
          WEB: "var(--fw-bold)",
          iOS: "Font.bold",
        },
      }),
      number("V:any", "any", ["ALL_SCOPES"], 4),
    ]);
    const [hidden, bold, any] = model.collections[0]?.variables ?? [];

    expect(hidden?.scopes).toEqual([]);
    expect(bold).toMatchObject({
      token: "--fw-bold",
      scopes: ["FONT_WEIGHT"],
      codeSyntax: {
        WEB: "var(--fw-bold)",
        iOS: "Font.bold",
      },
    });
    expect(any).not.toHaveProperty("scopes");
    expect(any).not.toHaveProperty("codeSyntax");
  });
});

describe("tokens_apply's plan: scopes and code syntax", () => {
  const plan = (variables: unknown[]) =>
    tokensPlan(
      TokensApplyInputSchema.parse({
        collections: [
          {
            name: "Tokens",
            variables,
          },
        ],
      }),
    );

  it("takes scopes and code syntax, the WEB one as the variable's CSS name", () => {
    const { plan: planned, errors } = plan([
      {
        name: "font-weight/bold",
        values: { Base: "700" },
        scopes: ["FONT_WEIGHT"],
        codeSyntax: {
          WEB: "var(--fw-bold)",
          iOS: "Font.bold",
        },
      },
    ]);

    expect(errors).toEqual([]);
    expect(planned.collections[0]?.variables[0]).toEqual({
      name: "font-weight/bold",
      type: "FLOAT",
      values: {
        Base: {
          kind: "number",
          value: 700,
        },
      },
      token: "--fw-bold",
      scopes: ["FONT_WEIGHT"],
      codeSyntax: {
        WEB: "var(--fw-bold)",
        iOS: "Font.bold",
      },
    });
  });

  it("refuses a token and a WEB code syntax that name two CSS properties", () => {
    const { plan: planned, errors } = plan([
      {
        name: "bold",
        token: "--bold",
        values: { Base: "700" },
        codeSyntax: { WEB: "var(--fw)" },
      },
    ]);

    expect(planned.collections[0]?.variables).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        name: "bold",
        message: expect.stringContaining("--bold"),
      }),
    ]);
  });

  it("marks plain numbers given no scopes, unless a variable of the call pointing at them gives some", () => {
    const { plan: planned } = plan([
      {
        name: "weight/700",
        values: { Base: "700" },
      },
      {
        name: "font-weight/bold",
        values: { Base: "var(--weight-700)" },
        scopes: ["FONT_WEIGHT"],
      },
      {
        name: "z/top",
        values: { Base: "100" },
      },
      {
        name: "space/4",
        values: { Base: "16px" },
      },
      {
        name: "none",
        values: { Base: "0" },
      },
    ]);

    expect(planned.collections[0]?.variables.filter((variable) => variable.unitless).map(({ name }) => name)).toEqual([
      "z/top",
    ]);
  });
});

describe("scopesError", () => {
  it("takes the scopes Figma gives each type, and names what it refuses", () => {
    expect(scopesError("FLOAT", ["FONT_WEIGHT", "GAP"])).toBeNull();
    expect(scopesError("FLOAT", [])).toBeNull();
    expect(scopesError("STRING", ["FONT_FAMILY"])).toBeNull();
    expect(scopesError("COLOR", ["ALL_FILLS", "STROKE_COLOR"])).toBeNull();
    expect(scopesError("COLOR", ["FONT_WEIGHT"])).toMatch(/FONT_WEIGHT/);
    expect(scopesError("FLOAT", ["ALL_SCOPES", "GAP"])).toMatch(/ALL_SCOPES/);
    expect(scopesError("COLOR", ["ALL_FILLS", "TEXT_FILL"])).toMatch(/ALL_FILLS/);
    expect(scopesError("BOOLEAN", [])).toMatch(/BOOLEAN/);
  });
});
