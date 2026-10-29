import { describe, expect, it } from "vitest";
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
import { ReadTokens } from "@/core/design/text/read-tokens.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

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
const tokens = new ReadTokens(paints, lengths, new EffectsGroup(solid, lengths, format, names), names);

/** #0F0F0F and #141414: the two Blacks a real file had. */
const black = (level: number, duplicate?: number) => ({
  name: "Black",
  type: "PAINT",
  remote: false,
  paints: [{ type: "SOLID", visible: true, opacity: 1, color: { r: level / 255, g: level / 255, b: level / 255 } }],
  ...(duplicate === undefined ? {} : { duplicate }),
});

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 12,
  spread: 0,
};

const MODEL: ReadModel = {
  model: 1,
  profile: "design",
  root: {
    id: "1:1",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: 0,
    fills: [{ type: "SOLID", color: { r: 20 / 255, g: 20 / 255, b: 20 / 255 } }],
    fillStyleId: "S:2",
  },
  styles: {
    "S:1": black(15),
    "S:2": black(20, 2),
    "S:3": { name: "Shadow/Card", type: "EFFECT", remote: false, effects: [SHADOW] },
  },
  variables: {
    "V:1": { name: "space/24", collection: "Orbit", resolvedType: "FLOAT", remote: false, value: 24 },
    "V:2": {
      name: "color/ink",
      collection: "Orbit",
      resolvedType: "COLOR",
      remote: false,
      value: { r: 1, g: 0, b: 0, a: 1 },
    },
    "V:3": { name: "flag", collection: "Orbit", resolvedType: "BOOLEAN", remote: false, value: true },
  },
};

// T-163, B-044: the JSON block's tokens, each same-named style its own.
describe("a read's tokens", () => {
  it("name each variable and paint or effect style the read uses with its value, sorted by name", () => {
    expect(tokens.read(MODEL)).toEqual({
      "--Black": "#0F0F0F",
      "--Black-2": "#141414",
      "--color-ink": "#F00",
      "--Shadow-Card": "0 4px 12px 0 rgba(0, 0, 0, 0.25)",
      "--space-24": "24px",
    });
  });

  it("write the second Black's fill as its own token", () => {
    expect(paints.css([], "S:2", MODEL)).toBe("var(--Black-2)");
  });
});
