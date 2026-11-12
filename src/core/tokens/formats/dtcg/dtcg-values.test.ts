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

const BRAND = { colorSpace: "srgb", components: [0.2314, 0.1843, 0.851], hex: "#3B2FD9" };

/** One collection, one mode, a library's colour, no styles: each case brings its variables. */
const raw = (variables: RawTokens["variables"]): RawTokens => ({
  collections: [
    { id: "C:orbit", name: "Orbit", remote: false, defaultModeId: "M:o", modes: [{ modeId: "M:o", name: "Light" }] },
  ],
  variables,
  external: { "V:lib": { name: "Accent/Primary", collection: "Core", resolvedType: "COLOR" } },
  styles: [],
});

describe("DTCG values", () => {
  it("types a token by the tokens that point at it, so no alias dangles or loses its unit (K-015)", () => {
    const { trees, notes } = dtcgTrees(
      raw([
        variable({ id: "V:sans", name: "font/sans", resolvedType: "STRING", valuesByMode: { "M:o": "Inter" } }),
        variable({
          id: "V:family",
          name: "heading/family",
          resolvedType: "STRING",
          scopes: ["FONT_FAMILY"],
          valuesByMode: { "M:o": alias("V:sans") },
        }),
        variable({ id: "V:4", name: "space/4", resolvedType: "FLOAT", valuesByMode: { "M:o": 16 } }),
        variable({
          id: "V:md",
          name: "gap/md",
          resolvedType: "FLOAT",
          scopes: ["GAP"],
          valuesByMode: { "M:o": alias("V:4") },
        }),
      ]),
    );

    expect(trees.orbit).toEqual({
      font: { sans: { $type: "fontFamily", $value: "Inter" } },
      heading: { family: { $type: "fontFamily", $value: "{font.sans}" } },
      space: { 4: { $type: "dimension", $value: { value: 16, unit: "px" } } },
      gap: { md: { $type: "dimension", $value: "{space.4}" } },
    });
    expect(notes.join("\n")).not.toMatch(/font\/sans/);
  });

  it("writes a token whose alias took another type as its value, so no reference names a token of another type (K-015)", () => {
    const { trees, notes } = dtcgTrees(
      raw([
        variable({ id: "V:700", name: "scale/700", resolvedType: "FLOAT", valuesByMode: { "M:o": 700 } }),
        variable({
          id: "V:wide",
          name: "gap/wide",
          resolvedType: "FLOAT",
          scopes: ["GAP"],
          valuesByMode: { "M:o": alias("V:700") },
        }),
        variable({
          id: "V:bold",
          name: "weight/bold",
          resolvedType: "FLOAT",
          scopes: ["FONT_WEIGHT"],
          valuesByMode: { "M:o": alias("V:700") },
        }),
      ]),
    );

    // The first link types the primitive: the gap's length.
    expect(trees.orbit).toEqual({
      scale: { 700: { $type: "dimension", $value: { value: 700, unit: "px" } } },
      gap: { wide: { $type: "dimension", $value: "{scale.700}" } },
      weight: { bold: { $type: "fontWeight", $value: 700 } },
    });
    expect(notes.join("\n")).toMatch(/weight\/bold \(Light\) points at a dimension token: .*written resolved/);
  });

  it("writes a composed colour as one colour with its alpha, a variable in it resolved, else its colour's reference (K-016)", () => {
    const { trees, notes } = dtcgTrees(
      raw([
        variable({ id: "V:brand", name: "brand", valuesByMode: { "M:o": rgb(59, 47, 217) } }),
        variable({
          id: "V:half",
          name: "half",
          resolvedType: "FLOAT",
          scopes: ["OPACITY"],
          valuesByMode: { "M:o": 50 },
        }),
        variable({ id: "V:veil", name: "veil", valuesByMode: { "M:o": { color: rgb(0, 0, 0), opacity: 0.4 } } }),
        variable({ id: "V:tint", name: "tint", valuesByMode: { "M:o": { color: alias("V:brand"), opacity: 64 } } }),
        variable({
          id: "V:glow",
          name: "glow",
          valuesByMode: { "M:o": { color: rgb(255, 255, 255), opacity: alias("V:half") } },
        }),
        variable({ id: "V:ghost", name: "ghost", valuesByMode: { "M:o": { color: alias("V:lib"), opacity: 50 } } }),
        variable({ id: "V:junk", name: "junk", valuesByMode: { "M:o": "not a colour" } }),
      ]),
    );
    const text = notes.join("\n");

    expect(trees.orbit).toEqual({
      brand: { $type: "color", $value: BRAND },
      half: { $type: "number", $value: 50 },
      veil: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.4, hex: "#000000" } },
      tint: { $type: "color", $value: { ...BRAND, alpha: 0.64 } },
      glow: { $type: "color", $value: { colorSpace: "srgb", components: [1, 1, 1], alpha: 0.5, hex: "#FFFFFF" } },
      ghost: { $type: "color", $value: "{Accent.Primary}" },
    });
    expect(text).toMatch(/tint \(Light\).*resolved/);
    expect(text).toMatch(/glow \(Light\).*resolved/);
    expect(text).toMatch(/ghost \(Light\).*without its opacity/);
    expect(text).toMatch(/junk \(Light\).*left out/);
  });
});
