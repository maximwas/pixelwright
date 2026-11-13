import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { BindRequest } from "@/core/tokens/bind/bind.types.ts";
import { BindFields } from "@/core/tokens/bind/bind-fields.ts";
import { BindValues } from "@/core/tokens/bind/bind-values.ts";
import { TokensBind } from "@/core/tokens/bind/tokens-bind.ts";
import type { ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";
import type { RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const bind = new TokensBind(
  new BindValues(
    new FontShorthand(format, new FontWeight()),
    new EffectsGroup(new SolidPaint(names), new CssLength(new CssVar(new CssSplit()), format, names), format, names),
    format,
  ),
  new BindFields(),
  names,
);

/** #369, and the same blue one step redder (#346699). */
const BLUE = { r: 0.2, g: 0.4, b: 0.6, a: 1 };
const OFF_BLUE = { r: 52 / 255, g: 0.4, b: 0.6, a: 1 };
const RED = { r: 1, g: 0, b: 0, a: 1 };

const NO_PICKS: BindRequest = { choose: [], remap: [] };

function variable(
  name: string,
  value: unknown,
  scopes: string[] = ["ALL_SCOPES"],
  type = "COLOR",
): RawVariable {
  return {
    id: `VariableID:${name}`,
    name,
    collectionId: "c",
    resolvedType: type,
    scopes,
    valuesByMode: { light: value },
  };
}

function tokens(...variables: RawVariable[]): RawTokens {
  const modes = [{ modeId: "light", name: "Light" }];

  return {
    collections: [{ id: "c", name: "Theme", remote: false, defaultModeId: "light", modes }],
    variables,
    external: {},
    styles: [],
  };
}

function layer(id: string, fields: Partial<ScannedLayer>): ScannedLayer {
  const empty = { modes: {}, layout: {}, numbers: {}, bound: [], stroked: false, paints: [], texts: [], uses: {} };

  return { id, type: "RECTANGLE", ...empty, ...fields };
}

function fill(color: { r: number; g: number; b: number }, opacity = 1) {
  return { at: "fills" as const, color, opacity, stylable: true };
}

function plan(
  raw: RawTokens,
  layers: ScannedLayer[],
  request: BindRequest = NO_PICKS,
) {
  return bind.plan(bind.index(raw), { layers, instances: 0, defaults: 0, cut: false }, request);
}

describe("TokensBind", () => {
  it("binds a colour one token holds, lists one two tokens hold as ambiguous, one none holds as unmatched (T-167)", () => {
    const raw = tokens(variable("Blue/500", BLUE), variable("Brand", BLUE), variable("Red", RED));
    const result = plan(raw, [
      layer("1:2", { paints: [fill(BLUE)] }),
      layer("1:3", { paints: [fill(RED)] }),
      layer("1:4", { paints: [fill(OFF_BLUE)] }),
      layer("1:5", { paints: [fill(RED, 0.5)] }),
    ]);

    expect(result.ambiguous).toEqual([
      {
        kind: "color",
        field: "background",
        value: "#369",
        count: 1,
        examples: ["1:2"],
        candidates: ["--Blue-500", "--Brand"],
      },
    ]);
    // A see-through red no token holds binds to the opaque red, keeping its opacity (K-029).
    expect(result.bound).toEqual([
      { kind: "color", field: "background", value: "#F00", count: 1, examples: ["1:3"], token: "--Red" },
      {
        kind: "color",
        field: "background",
        value: "rgba(255, 0, 0, 0.5)",
        count: 1,
        examples: ["1:5"],
        token: "--Red",
      },
    ]);
    expect(result.unmatched).toEqual([
      { kind: "color", field: "background", value: "#346699", count: 1, examples: ["1:4"] },
    ]);
    expect(result.layers).toBe(2);
  });

  it("offers a variable only for the fields its scopes allow, never one with no scopes (K-026, K-027)", () => {
    const raw = tokens(
      variable("Hidden", BLUE, []),
      variable("Text", BLUE, ["TEXT_FILL"]),
      variable("Fill", BLUE, ["ALL_FILLS"]),
      variable("Stroke", BLUE, ["STROKE_COLOR"]),
    );
    const stroke = { ...fill(BLUE), at: "strokes" as const };
    const result = plan(raw, [layer("1:2", { paints: [fill(BLUE), stroke] })]);

    expect(result.bound.map(({ field, token }) => [field, token])).toEqual([
      ["background", "--Fill"],
      ["border", "--Stroke"],
    ]);
    expect(result.ambiguous).toEqual([]);
  });

  it("matches a layer's opacity to an OPACITY variable holding it as a percent (FX-049)", () => {
    const raw = tokens(variable("Half", 50, ["OPACITY"], "FLOAT"), variable("Gap", 0.5, ["GAP"], "FLOAT"));
    const result = plan(raw, [layer("1:2", { numbers: { opacity: 0.5 } })]);

    expect(result.bound).toEqual([
      { kind: "number", field: "opacity", value: "0.5", count: 1, examples: ["1:2"], token: "--Half" },
    ]);
  });

  it("prefers an alias to the variable it points at (K-026)", () => {
    const raw = tokens(
      variable("Blue/500", BLUE),
      variable("Brand", { type: "VARIABLE_ALIAS", id: "VariableID:Blue/500" }),
    );

    expect(plan(raw, [layer("1:2", { paints: [fill(BLUE)] })]).bound.map(({ token }) => token)).toEqual(["--Brand"]);
  });

  it("snaps a value to a chosen token that does not hold it, and refuses a token of another kind (K-029)", () => {
    const raw = tokens(variable("Brand", BLUE), variable("Gap", 8, ["GAP"], "FLOAT"));
    const choose = [
      { value: "#346699", token: "--Brand" },
      { value: "#F00", token: "--Gap" },
    ];
    const result = plan(raw, [layer("1:2", { paints: [fill(OFF_BLUE), fill(RED)] })], { choose, remap: [] });

    expect(result.bound).toEqual([
      {
        kind: "color",
        field: "background",
        value: "#346699",
        count: 1,
        examples: ["1:2"],
        token: "--Brand",
        snapped: true,
      },
    ]);
    expect(result.errors).toEqual([
      { id: "1:2", message: "--Gap is no colour token: give a colour variable or a paint style." },
    ]);
  });

  it("counts each layer's uses of a remap's from token, and refuses a pair of two kinds (K-029)", () => {
    const raw = tokens(variable("Brand", BLUE), variable("Ink", RED), variable("Gap", 8, ["GAP"], "FLOAT"));
    const index = bind.index(raw);
    const remap = [
      { from: "--Brand", to: "--Ink" },
      { from: "--Brand", to: "--Gap" },
    ];
    const scan = { layers: [layer("1:2", { uses: { "VariableID:Brand": 2 } })], instances: 0, defaults: 0, cut: false };
    const result = bind.plan(index, scan, { choose: [], remap });

    expect(index.sources(remap)).toEqual(["VariableID:Brand"]);
    expect(result.remapped).toEqual([{ from: "--Brand", to: "--Ink", count: 2 }]);
    expect(result.errors).toEqual([
      {
        id: "--Brand",
        message: "--Brand is a colour variable and --Gap a number variable: rebind a token to one of its own kind.",
      },
    ]);
    expect(result.layers).toBe(1);
  });
});
