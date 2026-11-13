import { describe, expect, it } from "vitest";
import { EffectsWriter } from "@/core/css/groups/effects/effects-writer.ts";
import { PaintValue } from "@/core/css/paints/paint-value.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const vars = new CssVar(split);
const lengths = new CssLength(vars, new NumberFormat(), new TokenNames());
const paints = new PaintValue(vars);
const writer = new EffectsWriter(paints, lengths, split, vars);

type Attributes = Readonly<Record<string, string>>;

/** What the writer sets for an element's attributes over what the layer has now (`current`). */
function written(
  attributes: Attributes,
  current: Attributes = {},
  tag = "Frame",
) {
  const out = new ChangeOutput();

  writer.write(
    {
      tag,
      own: (name) => attributes[name],
      merged: (name) => attributes[name] ?? current[name],
      changed: (name) => attributes[name] !== undefined,
      hidden: false,
      existing: true,
    },
    out,
  );

  return { props: out.props, sources: out.sources, problems: out.problems };
}

describe("EffectsWriter", () => {
  // C-103: one list, blurs then the shadows bottom first; a new blur keeps the layer's shadows.
  it("writes a new blur with the layer's shadows, as one list", () => {
    const { props, sources } = written(
      { filter: "blur(4.3px)" },
      { "box-shadow": "0 1px 2px 0 #000, inset 0 0 4px 1px var(--glow)" },
    );

    expect(props.effects).toEqual([
      { type: "LAYER_BLUR", radius: 10 },
      { type: "INNER_SHADOW", color: null, token: "--glow", x: 0, y: 0, radius: 4, spread: 1 },
      { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, x: 0, y: 1, radius: 2, spread: 0 },
    ]);
    expect(sources.effects).toBe("filter");
  });

  // C-106: 2 to 4 lengths, inset anywhere, the colour the rest.
  it("reads inset anywhere and the colour as the other words", () => {
    expect(written({ "box-shadow": "2px 3px #000 inset" }).props.effects).toEqual([
      { type: "INNER_SHADOW", color: { r: 0, g: 0, b: 0, a: 1 }, x: 2, y: 3, radius: 0, spread: 0 },
    ]);
    expect(written({ "box-shadow": "1px #000" }).problems[0]?.message).toBe(
      '"1px #000" is not a shadow: [inset] x y [blur] [spread] and a colour.',
    );
  });

  // C-104: a var() on the shadows binds the effect style; an effect beside it is an error.
  it("binds an effect style and refuses a blur beside it", () => {
    expect(written({ "box-shadow": "var(--elevation-2)" }).props.effects).toEqual({ token: "--elevation-2" });
    expect(written({ "box-shadow": "var(--elevation-2)", filter: "blur(2px)" }).problems).toEqual([
      {
        attribute: "filter",
        message: "The effect style --elevation-2 holds every effect: change the style, or write its shadows out.",
      },
    ]);
  });

  // C-105, FX-048: a shadow's colour variable is its whole colour, alpha too.
  it("refuses a shadow colour variable at a share and a filter that is no blur", () => {
    expect(
      written({ "box-shadow": "0 1px 2px color-mix(in srgb, var(--ink) 50%, transparent)" }).problems[0]?.message,
    ).toBe(
      "A shadow's colour variable is its whole colour, its alpha too: write var(--ink) alone, or the colour with that alpha as a value.",
    );
    expect(written({ filter: "grayscale(1)" }).problems[0]?.message).toBe(
      'filter="grayscale(1)" is not blur(Npx), the one filter Figma has.',
    );
  });
});
