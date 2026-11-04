import { defineConfig, parse } from "@terrazzo/parser";
import StyleDictionary from "style-dictionary";
import type { DesignTokens } from "style-dictionary/types";
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
import { TokensCss } from "@/core/tokens/formats/css/tokens-css.ts";
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
import { goldenTokens } from "./fixtures/tokens-input.ts";

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
const weight = new FontWeight();
const tokens = new TokenModel(
  new VariableCss(solid, new EasingCss(format), format, units),
  new StyleTokens(paints, new EffectsGroup(solid, lengths, format, names), new FontShorthand(format, weight), names),
  units,
  names,
);
const css = new TokensCss();
const paths = new DtcgPaths();
const references = new DtcgReferences(new DtcgTypes(units), paths);
const values = new DtcgValues(format, units, references);
const dtcg = new TokensDtcg(references, paths, values, new DtcgStyles(paths, values, weight));

type Tree = Record<string, unknown>;

const isGroup = (value: unknown): value is Tree =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !("$value" in value);

/** Trees laid over each other, as a token tool merges its source files. */
const merge = (into: Tree, from: Tree): Tree =>
  Object.fromEntries([
    ...Object.entries(into),
    ...Object.entries(from).map(([key, value]) => {
      const before = into[key];

      return [key, isGroup(before) && isGroup(value) ? merge(before, value) : value];
    }),
  ]);

/** A colour token at each library variable's name path: the library's own token file, which a user adds. */
const libraryTree = (raw: RawTokens): Tree =>
  Object.values(raw.external).reduce<Tree>(
    (tree, { name }) =>
      merge(
        tree,
        name
          .split("/")
          .reduceRight<Tree>((inner, key) => ({ [key]: inner }), {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" },
          }),
      ),
    {},
  );

/** Each tree with the first tree of every other collection, the styles and the library: one theme's token files. */
const themes = (trees: Record<string, Tree>, library: Tree): Tree[][] => {
  const collection = (key: string) => key.split(".")[0] ?? key;
  const firsts = new Map<string, Tree>();

  for (const [key, tree] of Object.entries(trees)) {
    if (!firsts.has(collection(key))) {
      firsts.set(collection(key), tree);
    }
  }

  return Object.entries(trees).map(([key, tree]) => [
    tree,
    ...[...firsts].filter(([other]) => other !== collection(key)).map(([, first]) => first),
    library,
  ]);
};

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * 0.7.0's input with one more paint style: Glow's paint has no stops (0.7.0 took its CSS from getCSSAsync on a layer),
 * so a gradient drawn from its paints (C-022, D-20) shows the own math: left to right, white to black.
 */
const withDrawnGradient = (raw: RawTokens): RawTokens => ({
  ...raw,
  styles: [
    ...raw.styles,
    {
      id: "S:drawn",
      name: "Glow/Drawn",
      type: "PAINT",
      remote: false,
      paints: [
        {
          type: "GRADIENT_LINEAR",
          visible: true,
          opacity: 1,
          blendMode: "NORMAL",
          gradientTransform: [
            [1, 0, 0],
            [0, 1, 0],
          ],
          gradientStops: [
            { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
          ],
        },
      ],
    },
  ],
});

/**
 * The token model and its CSS as 0.7.0 wrote them, for an sRGB and a Display P3 file, with 0.8.0's reviewed moves: a
 * gradient style from its paints, not Figma's CSS (C-022, D-20); an effect style's blurs as tokens (D-26); a spring
 * as a note until the Motion item (D-24); a text style's line height in px to two decimals, as design_read (D-15).
 */
describe.each([
  ["srgb", undefined],
  ["p3", "DISPLAY_P3"],
])("golden tokens (%s)", (space, profile) => {
  const input = withDrawnGradient(goldenTokens(profile));
  const model = tokens.model(input);

  it("keeps the token model", async () => {
    await expect(json(model)).toMatchFileSnapshot(`__golden__/tokens.${space}.model.json`);
  });

  it("keeps the CSS", async () => {
    await expect(css.write(model)).toMatchFileSnapshot(`__golden__/tokens.${space}.css`);
  });

  it("keeps the DTCG trees and notes", async () => {
    await expect(json(dtcg.write(input, model))).toMatchFileSnapshot(`__golden__/tokens.${space}.dtcg.json`);
  });

  it("writes DTCG that Terrazzo parses and Style Dictionary resolves, every alias included (K-013..K-017)", async () => {
    const config = defineConfig({}, { cwd: new URL(import.meta.url) });

    for (const theme of themes(dtcg.write(input, model).trees, libraryTree(input))) {
      await parse(
        theme.map((tree, index) => ({ filename: new URL(`file:///tokens-${index}.json`), src: JSON.stringify(tree) })),
        { config },
      );

      const dictionary = new StyleDictionary({
        tokens: theme.reduce(merge, {}) as DesignTokens,
        platforms: { check: {} },
        log: { verbosity: "silent", errors: { brokenReferences: "throw" } },
      });

      const { allTokens } = await dictionary.getPlatformTokens("check");

      expect(allTokens.filter(({ $value }) => typeof $value === "string" && /^\{.*\}$/.test($value))).toEqual([]);
    }
  });
});
