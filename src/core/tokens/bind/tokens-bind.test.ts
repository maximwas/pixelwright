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
import type { BindScan, ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";
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
  return { at: "fills" as const, index: 0, color, opacity, stylable: true };
}

function scan(layers: ScannedLayer[], variables: BindScan["variables"] = {}): BindScan {
  return { layers, variables, instances: 0, defaults: 0, cut: false };
}

/** A library's variable Figma inferred, which the file does not hold: named, typed, scoped and keyed. */
function library(
  name: string,
  type = "COLOR",
  scopes = ["ALL_SCOPES"],
) {
  return { name, resolvedType: type, scopes, key: `key-${name}` };
}

function plan(
  raw: RawTokens,
  layers: ScannedLayer[],
  request: BindRequest = NO_PICKS,
) {
  return bind.plan(bind.index(raw), scan(layers), request).result;
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
    const { result, plan: planned } = bind.plan(index, scan([layer("1:2", { uses: { "VariableID:Brand": 2 } })]), {
      choose: [],
      remap,
    });

    expect(index.sources(remap)).toEqual(["VariableID:Brand"]);
    expect(result.remapped).toEqual([{ from: "--Brand", to: "--Ink", count: 2 }]);
    expect(result.errors).toEqual([
      {
        id: "--Brand",
        message: "--Brand is a colour variable and --Gap a number variable: rebind a token to one of its own kind.",
      },
    ]);
    expect(result.layers).toBe(1);
    expect(planned.remaps).toEqual([
      { layer: "1:2", from: "VariableID:Brand", to: { id: "VariableID:Ink", source: "variable", token: "--Ink" } },
    ]);
  });

  it("plans every bound use for the writer: its layer, the token's id, Figma's fields, a paint's place, opacity and range (T-167)", () => {
    const raw = tokens(
      variable("Brand", BLUE),
      variable("Space", 8, ["GAP"], "FLOAT"),
      variable("Round", 4, ["CORNER_RADIUS"], "FLOAT"),
    );
    const corners = { topLeftRadius: 4, topRightRadius: 4, bottomRightRadius: 4, bottomLeftRadius: 4 };
    const card = layer("1:2", {
      type: "FRAME",
      layout: { layoutMode: "VERTICAL" },
      numbers: { paddingTop: 8, ...corners },
      paints: [{ ...fill(BLUE, 0.5), index: 1, stylable: false }],
    });
    const label = layer("1:3", {
      type: "TEXT",
      paints: [{ ...fill(OFF_BLUE), at: "run", range: { start: 2, end: 5 } }],
    });
    const brand = { id: "VariableID:Brand", source: "variable", token: "--Brand" };
    const request = { choose: [{ value: "#346699", token: "--Brand" }], remap: [] };

    expect(bind.plan(bind.index(raw), scan([card, label]), request).plan).toEqual({
      binds: [
        { layer: "1:2", kind: "color", at: "fills", index: 1, opacity: 0.5, target: brand, snapped: false },
        {
          layer: "1:2",
          kind: "number",
          fields: ["paddingTop"],
          target: { id: "VariableID:Space", source: "variable", token: "--Space" },
          snapped: false,
        },
        {
          layer: "1:2",
          kind: "number",
          fields: Object.keys(corners),
          target: { id: "VariableID:Round", source: "variable", token: "--Round" },
          snapped: false,
        },
        {
          layer: "1:3",
          kind: "color",
          at: "run",
          index: 0,
          range: { start: 2, end: 5 },
          opacity: 1,
          target: brand,
          snapped: true,
        },
      ],
      remaps: [],
    });
  });

  it("plans a text run's text style on its range, and refuses one where Figma lacks the text's font (T-167)", () => {
    const parts = { fontName: { family: "Inter", style: "Regular" }, fontSize: 16, lineHeight: { unit: "AUTO" } };
    const raw = { ...tokens(), styles: [{ id: "S:body", type: "TEXT", name: "Body", remote: false, ...parts }] };
    const run = { ...parts, letterSpacing: { unit: "PIXELS", value: 0 }, textCase: "ORIGINAL", textDecoration: "NONE" };
    const text = layer("1:2", {
      type: "TEXT",
      texts: [{ ...run, range: { start: 0, end: 4 } }] as ScannedLayer["texts"],
    });
    const planned = bind.plan(bind.index(raw), scan([text, { ...text, id: "1:3", missingFont: true }]), NO_PICKS);

    expect(planned.result.errors).toEqual([{ id: "1:3", message: expect.stringContaining("font") }]);
    expect(planned.plan.binds).toEqual([
      {
        layer: "1:2",
        kind: "text",
        range: { start: 0, end: 4 },
        target: { id: "S:body", source: "style", token: "--Body-font" },
        snapped: false,
      },
    ]);
  });

  it("offers a library's variable Figma infers within the field's scopes, and leaves the file's to the index (P-164)", () => {
    const raw = tokens(variable("Stroke", OFF_BLUE, ["STROKE_COLOR"]), variable("Brand", BLUE));
    const inferred = ["VariableID:lib/1", "VariableID:lib/2", "VariableID:Stroke"];
    const layers = [
      layer("1:2", { paints: [{ ...fill(OFF_BLUE), inferred }] }),
      layer("1:3", { numbers: { opacity: 0.4 }, inferred: { opacity: ["VariableID:lib/3"] } }),
      layer("1:4", { paints: [{ ...fill(BLUE), inferred: ["VariableID:lib/4"] }] }),
    ];
    const variables = {
      "VariableID:lib/1": library("Lib/Blue"),
      "VariableID:lib/2": library("Lib/Text", "COLOR", ["TEXT_FILL"]),
      "VariableID:lib/3": library("Faded", "FLOAT"),
      "VariableID:lib/4": library("Lib/Brand"),
    };
    const index = bind.index(raw);
    const { result } = bind.plan(index, scan(layers, variables), NO_PICKS);
    const choose = [{ value: "#369", token: "--Lib-Brand" }];
    const picked = bind.plan(index, scan(layers.slice(2), variables), { choose, remap: [] });

    expect(result.bound.map(({ token, examples }) => [token, examples])).toEqual([
      ["--Lib-Blue", ["1:2"]],
      ["--Faded", ["1:3"]],
    ]);
    expect(result.ambiguous.map(({ candidates }) => candidates)).toEqual([["--Brand", "--Lib-Brand"]]);
    expect(result.unmatched).toEqual([]);
    expect(picked.plan.binds.map(({ target }) => target)).toEqual([
      { token: "--Lib-Brand", id: "VariableID:lib/4", source: "variable", key: "key-Lib/Brand" },
    ]);
  });

  it("says when the read of the tokens the layers use ran out of time: a library token past it was not considered", () => {
    const { result } = bind.plan(bind.index({ ...tokens(), usedCut: true }), scan([]), NO_PICKS);

    expect(result.notes).toEqual([
      "The scan for the library tokens the layers use ran out of time: a library style or variable used only on layers it did not reach was not considered, so a value only it holds is listed with no token. Bind a page or a layer at a time.",
    ]);
  });
});
