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
import { DtcgPaths } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DtcgReferences } from "@/core/tokens/formats/dtcg/dtcg-references.ts";
import { DtcgStyles } from "@/core/tokens/formats/dtcg/dtcg-styles.ts";
import { DtcgTypes } from "@/core/tokens/formats/dtcg/dtcg-types.ts";
import { DtcgValues } from "@/core/tokens/formats/dtcg/dtcg-values.ts";
import { TokensDtcg } from "@/core/tokens/formats/dtcg/tokens-dtcg.ts";
import { NumberUnits } from "@/core/tokens/model/number-units.ts";
import { StyleTokens } from "@/core/tokens/model/style-tokens.ts";
import { TokenModel } from "@/core/tokens/model/token-model.ts";
import { VariableCss } from "@/core/tokens/model/variable-css.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const units = new NumberUnits();
const weight = new FontWeight();
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const solid = new SolidPaint(names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const tokens = new TokenModel(
  new VariableCss(solid, new EasingCss(format), format, units),
  new StyleTokens(paints, new EffectsGroup(solid, lengths, format, names), new FontShorthand(format, weight), names),
  units,
  names,
);
const paths = new DtcgPaths();
const references = new DtcgReferences(new DtcgTypes(units), paths);
const values = new DtcgValues(format, units, references);
const dtcg = new TokensDtcg(references, paths, values, new DtcgStyles(paths, values, weight));

/** The trees and notes tokens_read gives for a file's raw tokens, the collections asked for only. */
const dtcgTrees = (raw: RawTokens, collections?: readonly string[]) => dtcg.write(raw, tokens.model(raw, collections));

const rgb = (
  red: number,
  green: number,
  blue: number,
  alpha = 1,
) => ({
  r: red / 255,
  g: green / 255,
  b: blue / 255,
  a: alpha,
});

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

const variable = (fields: Partial<RawTokens["variables"][number]> & { id: string; name: string; valuesByMode: Record<string, unknown> }) => ({ collectionId: "C:orbit", resolvedType: "COLOR", scopes: ["ALL_SCOPES"], ...fields });

const style = (fields: Record<string, unknown> & { id: string; name: string; type: string }) =>
  ({ remote: false, ...fields }) as RawTokens["styles"][number];

const BRAND = { colorSpace: "srgb", components: [0.2314, 0.1843, 0.851], hex: "#3B2FD9" };

type Tree = Record<string, Record<string, Record<string, unknown>>>;

const RAW: RawTokens = {
  collections: [
    { id: "C:orbit", name: "Orbit", remote: false, defaultModeId: "M:o", modes: [{ modeId: "M:o", name: "Light" }] },
    {
      id: "C:theme",
      name: "Brand Theme",
      remote: false,
      defaultModeId: "M:l",
      modes: [
        { modeId: "M:l", name: "Light" },
        { modeId: "M:d", name: "Dark Mode" },
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
    variable({ id: "V:hover", name: "color/brand/hover", valuesByMode: { "M:o": rgb(42, 32, 184) } }),
    variable({ id: "V:veil", name: "color/veil", valuesByMode: { "M:o": rgb(0, 0, 0, 0.5) } }),
    variable({
      id: "V:space",
      name: "space/16",
      resolvedType: "FLOAT",
      scopes: ["GAP", "WIDTH_HEIGHT"],
      valuesByMode: { "M:o": 16 },
    }),
    variable({ id: "V:half", name: "space/1.5", resolvedType: "FLOAT", scopes: ["GAP"], valuesByMode: { "M:o": 6 } }),
    variable({
      id: "V:bold",
      name: "font/weight/bold",
      resolvedType: "FLOAT",
      scopes: ["FONT_WEIGHT"],
      valuesByMode: { "M:o": 700 },
    }),
    variable({ id: "V:ratio", name: "ratio", resolvedType: "FLOAT", scopes: [], valuesByMode: { "M:o": 1.5 } }),
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
    variable({ id: "V:beta", name: "flag/beta", resolvedType: "BOOLEAN", valuesByMode: { "M:o": true } }),
    variable({
      id: "V:surface",
      name: "surface",
      collectionId: "C:theme",
      valuesByMode: { "M:l": rgb(255, 255, 255), "M:d": alias("V:brand") },
    }),
    variable({
      id: "V:accent",
      name: "accent",
      collectionId: "C:theme",
      valuesByMode: { "M:l": alias("V:lib"), "M:d": alias("V:hover") },
    }),
  ],
  external: { "V:lib": { name: "Accent/Primary", collection: "Core", resolvedType: "COLOR" } },
  styles: [
    style({
      id: "S:primary",
      name: "Brand/Primary",
      type: "PAINT",
      paints: [{ type: "SOLID", color: rgb(59, 47, 217) }],
    }),
    style({ id: "S:deep", name: "Brand/Deep", type: "PAINT", paints: [{ type: "SOLID", color: rgb(42, 32, 184) }] }),
  ],
};

const BRAND_TOKENS = {
  $root: { $type: "color", $value: BRAND, $description: "The one accent." },
  hover: { $type: "color", $value: { colorSpace: "srgb", components: [0.1647, 0.1255, 0.7216], hex: "#2A20B8" } },
};

describe("DTCG trees", () => {
  it("makes one tree per collection mode, a one-mode collection keyed by its name alone, and one for styles (K-013)", () => {
    expect(Object.keys(dtcgTrees(RAW).trees)).toEqual([
      "orbit",
      "brand-theme.light",
      "brand-theme.dark-mode",
      "styles",
    ]);
  });

  it("types colours, dimensions, weights, numbers and font families from the variable's type and scopes (K-015)", () => {
    const { orbit } = dtcgTrees(RAW).trees as Tree;

    expect(orbit?.color?.veil).toEqual({
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5, hex: "#000000" },
    });
    expect(orbit?.space).toEqual({
      16: { $type: "dimension", $value: { value: 16, unit: "px" } },
      "1-5": { $type: "dimension", $value: { value: 6, unit: "px" } },
    });
    expect(orbit?.font).toEqual({
      weight: { bold: { $type: "fontWeight", $value: 700 } },
      family: { $type: "fontFamily", $value: "Inter" },
    });
    expect(orbit?.ratio).toEqual({ $type: "number", $value: 1.5 });
  });

  it("keeps a token whose path is also a group as the group's $root, and refers to it there (K-013)", () => {
    const { trees } = dtcgTrees(RAW);

    expect((trees.orbit as Tree).color?.brand).toEqual(BRAND_TOKENS);
    expect(trees["brand-theme.dark-mode"]).toEqual({
      surface: { $type: "color", $value: "{color.brand.$root}" },
      accent: { $type: "color", $value: "{color.brand.hover}" },
    });
  });

  it("refers to a library's variable by its name's path, and names where it lives (K-016)", () => {
    const { trees, notes } = dtcgTrees(RAW);

    expect((trees["brand-theme.light"] as Tree).accent).toEqual({ $type: "color", $value: "{Accent.Primary}" });
    expect(notes.join("\n")).toMatch(
      /accent points at Accent\/Primary from a library \(Core\): no file here defines it/,
    );
  });

  it("names the variables DTCG has no type for instead of dropping them silently", () => {
    const { trees, notes } = dtcgTrees(RAW);

    expect(JSON.stringify(trees)).not.toContain("Buy");
    expect(notes.join("\n")).toMatch(
      /2 variables have no DTCG type and are left out: copy\/label \(STRING\), flag\/beta/,
    );
  });

  it("names an alias to a variable it cannot find, and leaves that token out", () => {
    const { trees, notes } = dtcgTrees({
      ...RAW,
      variables: [variable({ id: "V:lost", name: "lost", valuesByMode: { "M:o": alias("V:gone") } })],
    });

    expect(trees.orbit).toEqual({});
    expect(notes.join("\n")).toMatch(/lost points at a variable that is neither in this file nor in a library it uses/);
  });

  it("keeps only the collections asked for, styles included, and names a target one left out holds", () => {
    const { trees, notes } = dtcgTrees(RAW, ["brand theme"]);

    expect(Object.keys(trees)).toEqual(["brand-theme.light", "brand-theme.dark-mode", "styles"]);
    expect(notes.join("\n")).toMatch(/surface points at color\/brand in Orbit, which this output leaves out/);
  });

  it("writes only what a part of the model holds, so maxChars cuts DTCG as it cuts CSS (T-161)", () => {
    const whole = tokens.model(RAW);
    const [orbit] = whole.collections;
    const part = {
      collections: orbit === undefined ? [] : [{ ...orbit, variables: orbit.variables.slice(0, 2) }],
      styles: { paint: whole.styles.paint.slice(0, 1), text: [], effect: [] },
    };

    expect(dtcg.write(RAW, part, whole).trees).toEqual({
      orbit: { color: { brand: BRAND_TOKENS } },
      styles: { Brand: { Primary: { $type: "color", $value: BRAND } } },
    });
  });

  it("never lets one token overwrite another: a collection named Styles, same-named styles, names alike once cleaned (K-014)", () => {
    const { trees, notes } = dtcgTrees({
      ...RAW,
      collections: [
        ...RAW.collections,
        {
          id: "C:styles",
          name: "Styles",
          remote: false,
          defaultModeId: "M:s",
          modes: [{ modeId: "M:s", name: "Default" }],
        },
      ],
      variables: [
        variable({ id: "V:dot", name: "brand.primary", valuesByMode: { "M:o": rgb(255, 0, 0) } }),
        variable({ id: "V:dash", name: "brand-primary", valuesByMode: { "M:o": rgb(0, 0, 255) } }),
        variable({ id: "V:link", name: "link", valuesByMode: { "M:o": alias("V:dash") } }),
        variable({ id: "V:ink", name: "ink", collectionId: "C:styles", valuesByMode: { "M:s": rgb(0, 0, 0) } }),
      ],
      styles: [
        style({
          id: "S:local",
          name: "Brand/Primary",
          type: "PAINT",
          paints: [{ type: "SOLID", color: rgb(59, 47, 217) }],
        }),
        style({
          id: "S:library",
          name: "Brand/Primary",
          type: "PAINT",
          remote: true,
          paints: [{ type: "SOLID", color: rgb(0, 0, 0) }],
        }),
      ],
    });
    const orbit = trees.orbit as Record<string, { $value: unknown }>;
    const text = notes.join("\n");

    expect(Object.keys(trees)).toEqual(["orbit", "brand-theme.light", "brand-theme.dark-mode", "styles-2", "styles"]);
    expect((trees["styles-2"] as Tree).ink).toBeDefined();
    expect(Object.keys(orbit)).toEqual(["brand-primary", "brand-primary-2", "link"]);
    expect(orbit.link?.$value).toBe("{brand-primary-2}");
    expect(Object.keys((trees.styles as Tree).Brand ?? {})).toEqual(["Primary", "Primary-2"]);
    expect(text).toMatch(/The collection Styles is written as styles-2/);
    expect(text).toMatch(/brand-primary has the same DTCG path as another token: written as brand-primary-2/);
    expect(text).toMatch(/Brand\/Primary has the same DTCG path as another token: written as Brand\.Primary-2/);
  });
});
