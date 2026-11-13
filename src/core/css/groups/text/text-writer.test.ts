import { describe, expect, it } from "vitest";
import { FontValues } from "@/core/css/fonts/font-values.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { FillsWriter } from "@/core/css/groups/paint/fills-writer.ts";
import { PathGeometry } from "@/core/css/groups/text/path-geometry.ts";
import { TextWriter } from "@/core/css/groups/text/text-writer.ts";
import { PaintValue } from "@/core/css/paints/paint-value.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssAngle } from "@/core/css/values/css-angle.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const vars = new CssVar(split);
const format = new NumberFormat();
const lengths = new CssLength(vars, format, new TokenNames());
const fills = new FillsWriter(
  new PaintValue(vars),
  new GradientParser(split, vars, new GradientGeometry(), new CssAngle()),
  new CssUrl(split),
  split,
);
const writer = new TextWriter(fills, new FontValues(lengths, format, split), split, new PathGeometry(new CssAngle()));

/** What the writer sets for a Text's attributes. */
function written(attributes: Readonly<Record<string, string>>) {
  const out = new ChangeOutput();

  writer.write(
    {
      tag: "Text",
      own: (name) => attributes[name],
      merged: (name) => attributes[name],
      changed: (name) => attributes[name] !== undefined,
      hidden: false,
      existing: true,
    },
    out,
  );

  return { props: out.props, sources: out.sources, problems: out.problems };
}

describe("TextWriter", () => {
  // C-081: a text's paint is its colour, written after its type as 0.7.0's table did.
  it("writes a text's colour as its text fills, from color", () => {
    expect(written({ color: "#000" })).toMatchObject({
      props: { textFills: [{ kind: "color", color: { r: 0, g: 0, b: 0, a: 1 } }] },
      sources: { textFills: "color" },
    });
  });

  it("refuses an image or a gradient as a text's colour", () => {
    expect(
      [written({ color: 'url("a.png")' }), written({ color: "linear-gradient(#000, #fff)" })].map(
        ({ problems }) => problems[0],
      ),
    ).toEqual([
      { attribute: "color", message: "A text is coloured with paint, not an image.", hint: "Use a colour or a token." },
      {
        attribute: "color",
        message: "A text is coloured with a colour or a token, not a gradient.",
        hint: "Use a colour or a token.",
      },
    ]);
  });

  // C-115: Figma draws a decoration solid, wavy or dotted; a dashed one is refused in the plan, dry or real.
  it("refuses a dashed decoration, which Figma cannot draw", () => {
    expect(written({ "text-decoration": "underline dashed" })).toEqual({
      props: {},
      sources: {},
      problems: [
        {
          attribute: "text-decoration",
          message: "Figma underlines solid, wavy or dotted: it has no dashed decoration.",
        },
      ],
    });
  });
});
