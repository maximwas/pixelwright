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
import type { Placed, TokenSide } from "@/core/diff/baseline/baseline.types.ts";
import { TokenChanges } from "@/core/diff/baseline/token-changes.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NumberUnits } from "@/core/tokens/model/number-units.ts";
import { StyleTokens } from "@/core/tokens/model/style-tokens.ts";
import { VariableCss } from "@/core/tokens/model/variable-css.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** TokenChanges built as the server root binds it. */
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
const tokens = new TokenChanges(
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

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

function layer(fields: Partial<ReadLayer> & Pick<ReadLayer, "id" | "name">): ReadLayer {
  return { type: "RECTANGLE", visible: true, x: 0, y: 0, width: 40, height: 40, childCount: 0, ...fields };
}

/** An element design_read wrote for a layer, with its background. */
function placed(id: string, background: string): Placed {
  const element = {
    id,
    tag: "Rectangle",
    attributes: [["background", background] as const],
    content: null,
    children: [],
  };

  return { element, parent: "1:1", name: id, label: id, path: id };
}

/** One collection, one mode: brand aliases blue; red is a colour no layer is bound to. */
function raw(blue: unknown, red: unknown): RawTokens {
  const variable = (id: string, value: unknown) => ({
    id,
    name: id.slice(2),
    collectionId: "C:1",
    resolvedType: "COLOR",
    scopes: [],
    valuesByMode: { "M:1": value },
  });

  return {
    collections: [
      { id: "C:1", name: "Theme", remote: false, defaultModeId: "M:1", modes: [{ modeId: "M:1", name: "Light" }] },
    ],
    variables: [variable("V:brand", alias("V:blue")), variable("V:blue", blue), variable("V:red", red)],
    external: {},
    styles: [],
  };
}

describe("TokenChanges (K-057)", () => {
  // design_read writes a bound alias as var(), so the primitive behind it changes no attribute; Figma's inferred match
  // for a raw value is a hint, not a token the layer uses (m:335a001e).
  it("lists a primitive changed behind a bound alias with the layers bound to it, never a variable Figma only inferred", () => {
    const fill = { type: "SOLID", visible: true, color: RED };
    const root = layer({
      id: "1:1",
      name: "Page",
      type: "FRAME",
      childCount: 2,
      children: [
        layer({ id: "1:2", name: "Brand", fills: [{ ...fill, boundVariables: { color: alias("V:brand") } }] }),
        layer({ id: "1:3", name: "Guess", fills: [fill], inferred: { fills: "V:red" } }),
      ],
    });
    const read: ReadModel = {
      model: 1,
      profile: "design",
      root,
      styles: {},
      variables: {
        "V:brand": { name: "brand", collection: "Theme", resolvedType: "COLOR", remote: false },
        "V:red": { name: "red", collection: "Theme", resolvedType: "COLOR", remote: false },
      },
    };
    const layers = new Map([
      ["1:2", placed("1:2", "var(--brand)")],
      ["1:3", placed("1:3", "#F00")],
    ]);
    const side = (tokensNow: RawTokens): TokenSide => ({ raw: tokensNow, snapshot: read, layers, skip: new Set() });
    const notes: string[] = [];

    expect(tokens.of({ before: side(raw(BLUE, RED)), after: side(raw(GREEN, GREEN)) }, notes)).toEqual([
      { token: "--blue", name: "blue", before: "#00F", after: "#0F0", layers: 1 },
    ]);
    expect(notes).toEqual([]);
  });
});
