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

const BLUE = { r: 0.2, g: 0.4, b: 0.6, a: 1 };
const RED = { r: 1, g: 0, b: 0, a: 1 };

function variable(name: string, value: unknown): RawVariable {
  return {
    id: `VariableID:${name}`,
    name,
    collectionId: "c",
    resolvedType: "COLOR",
    scopes: ["ALL_SCOPES"],
    valuesByMode: { light: value },
  };
}

function textLayer(id: string, fields: Partial<ScannedLayer>): ScannedLayer {
  const empty = { modes: {}, layout: {}, numbers: {}, bound: [], stroked: false, paints: [], texts: [], uses: {} };

  return { id, type: "TEXT", ...empty, ...fields };
}

describe("TokensBind remaps on a text whose font Figma lacks", () => {
  it("refuses a remap of any token kind, as the writer loads the fonts for a run's style or variable (K-029, m:f66aed65)", () => {
    const solid = (color: typeof BLUE) => [{ type: "SOLID", color, opacity: 1 }];
    const modes = [{ modeId: "light", name: "Light" }];
    const raw: RawTokens = {
      collections: [{ id: "c", name: "Theme", remote: false, defaultModeId: "light", modes }],
      variables: [variable("Brand", BLUE), variable("Ink", RED)],
      external: {},
      styles: [
        { id: "S:sky", type: "PAINT", name: "Sky", remote: false, paints: solid(BLUE) },
        { id: "S:rose", type: "PAINT", name: "Rose", remote: false, paints: solid(RED) },
      ],
    };
    const uses = { "VariableID:Brand": 1, "S:sky": 1 };
    const remap = [
      { from: "--Brand", to: "--Ink" },
      { from: "--Sky", to: "--Rose" },
    ];
    const layers = [textLayer("1:2", { uses }), textLayer("1:3", { uses, missingFont: true })];
    const { result, plan } = bind.plan(
      bind.index(raw),
      { layers, variables: {}, instances: 0, defaults: 0, cut: false },
      { choose: [], remap },
    );

    expect(result.errors).toEqual([{ id: "1:3", message: expect.stringContaining("font") }]);
    expect(result.remapped).toEqual([
      { from: "--Brand", to: "--Ink", count: 1 },
      { from: "--Sky", to: "--Rose", count: 1 },
    ]);
    expect(plan.remaps.map(({ layer }) => layer)).toEqual(["1:2", "1:2"]);
  });
});
