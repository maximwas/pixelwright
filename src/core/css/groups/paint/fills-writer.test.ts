import { describe, expect, it } from "vitest";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { FillsWriter } from "@/core/css/groups/paint/fills-writer.ts";
import { PaintValue } from "@/core/css/paints/paint-value.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const vars = new CssVar(split);
const lengths = new CssLength(vars, new NumberFormat(), new TokenNames());
const paints = new PaintValue(vars);
const writer = new FillsWriter(
  paints,
  new GradientParser(split, vars, new GradientGeometry()),
  new CssUrl(split),
  split,
);

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

describe("FillsWriter", () => {
  // C-081: none and transparent clear the fills; CSS lists layers top first, Figma bottom first.
  it("writes no fills for none and the layers bottom first", () => {
    expect(written({ background: "transparent" }).props).toEqual({ fills: [] });
    expect(written({ background: "var(--brand), #000" }).props.fills).toEqual([
      { kind: "color", color: { r: 0, g: 0, b: 0, a: 1 } },
      { kind: "token", token: "--brand", opacity: 1 },
    ]);
  });

  // C-081: design_read writes a colour over an image as a flat gradient, which is that colour.
  it("writes a flat gradient as its colour and a faded token at its share", () => {
    expect(written({ background: "linear-gradient(#000, #000)" }).props.fills).toEqual([
      { kind: "color", color: { r: 0, g: 0, b: 0, a: 1 } },
    ]);
    expect(written({ background: "color-mix(in srgb, var(--ink) 40%, transparent)" }).props.fills).toEqual([
      { kind: "token", token: "--ink", opacity: 0.4 },
    ]);
  });

  // C-081: an image file fits by design_read's words: contain is FIT, a repeat TILE, anything else FILL.
  it("fits an image by contain and repeat", () => {
    const modes = [
      "url(a.png) center / contain no-repeat",
      "url(a.png) repeat",
      "url(a.png) center / cover no-repeat",
    ].map((background) => written({ background }).props.fills?.[0]);

    expect(modes.map((paint) => paint?.scaleMode)).toEqual(["FIT", "TILE", "FILL"]);
    expect(modes[0]).toMatchObject({ kind: "image", src: "a.png" });
  });

  // C-081: the refusals keep 0.7.0's words and hints.
  it("refuses an unquoted url, a repeating gradient and a word", () => {
    const messages = [
      written({ background: "url(my photo.png)" }),
      written({ background: "repeating-linear-gradient(#000, #fff 10%)" }),
      written({ background: "blue-ish" }),
    ].map(({ problems }) => problems[0]);

    expect(messages).toEqual([
      {
        attribute: "background",
        message: "url(my photo.png): url() without quotes cannot hold spaces, quotes, brackets or var().",
        hint: 'Write the file in quotes: url("my photo.png").',
      },
      {
        attribute: "background",
        message: "repeating-linear-gradient(#000, #fff 10%…: this gradient is not written.",
        hint: "Write linear-, radial- or conic-gradient() with colours or tokens in their stops (no repeating ones).",
      },
      {
        attribute: "background",
        message:
          'background="blue-ish" is not a colour, a token or color-mix(in srgb, var(--x) N%, transparent) (in display-p3 in a Display P3 file).',
      },
    ]);
  });
});
