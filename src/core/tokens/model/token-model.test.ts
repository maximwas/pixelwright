import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NumberUnits } from "@/core/tokens/model/number-units.ts";
import { StyleTokens } from "@/core/tokens/model/style-tokens.ts";
import { TokenModel } from "@/core/tokens/model/token-model.ts";
import { VariableCss } from "@/core/tokens/model/variable-css.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const solid = new SolidPaint(names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const units = new NumberUnits();
const tokens = new TokenModel(
  new VariableCss(solid, new EasingCss(format), format, units),
  new StyleTokens(
    paints,
    new EffectsGroup(solid, lengths, format, names),
    new FontShorthand(format, new FontWeight()),
    names,
  ),
  units,
  names,
);

const DARK = { r: 0.098, g: 0.102, b: 0.137, a: 1 };

const collection = (
  id: string,
  name: string,
  mode: string,
) => ({
  id,
  name,
  remote: false,
  defaultModeId: `${id}:mode`,
  modes: [{ modeId: `${id}:mode`, name: mode }],
});

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

const RAW: RawTokens = {
  collections: [collection("C:prim", "Primitives", "Value"), collection("C:sem", "Semantic", "Light")],
  variables: [
    {
      id: "V:gray",
      name: "gray/900",
      collectionId: "C:prim",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: { "C:prim:mode": DARK },
    },
    {
      id: "V:half",
      name: "opacity/half",
      collectionId: "C:prim",
      resolvedType: "FLOAT",
      scopes: ["OPACITY"],
      valuesByMode: { "C:prim:mode": 50 },
    },
    {
      id: "V:bg",
      name: "bg",
      collectionId: "C:sem",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: { "C:sem:mode": alias("V:gray") },
    },
    {
      id: "V:veil",
      name: "veil",
      collectionId: "C:sem",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: { "C:sem:mode": { color: alias("V:gray"), opacity: alias("V:half") } },
    },
  ],
  external: {},
  styles: [],
};

describe("token model: what the output uses but leaves out (K-005)", () => {
  it("names the collection that holds each target an alias or a composed colour points at", () => {
    const model = tokens.model(RAW, ["semantic"]);

    expect(model.collections.map(({ name }) => name)).toEqual(["Semantic"]);
    expect(model.collections[0]?.variables.map(({ values }) => values.Light)).toEqual([
      "var(--gray-900)",
      "color-mix(in srgb, var(--gray-900) calc(var(--opacity-half) * 100%), transparent)",
    ]);
    expect(model.notes).toEqual([
      "--gray-900 is used but not in this output: it is in Primitives; add that collection to collections.",
      "--opacity-half is used but not in this output: it is in Primitives; add that collection to collections.",
    ]);
  });
});
