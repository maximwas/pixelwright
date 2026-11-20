import { describe, expect, it } from "vitest";
import { StrokesWriter } from "@/core/css/groups/paint/strokes-writer.ts";
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
const writer = new StrokesWriter(paints, lengths, split);

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

describe("StrokesWriter", () => {
  // C-091: words in any order; one weight for every side.
  it("writes a border as one inside stroke, its words in any order", () => {
    expect(written({ border: "solid 2px #000" }).props.strokes).toEqual({
      paints: [{ kind: "color", color: { r: 0, g: 0, b: 0, a: 1 } }],
      weight: 2,
      align: "INSIDE",
      dash: false,
    });
  });

  // C-091, FX-060: a side alone changes only itself, the others kept from what the layer has.
  it("changes one side over the layer's border, the others kept", () => {
    expect(written({ "border-top": "0" }, { border: "1px dotted #000" }).props.strokes).toEqual({
      paints: [{ kind: "color", color: { r: 0, g: 0, b: 0, a: 1 } }],
      sides: { top: 0, right: 1, bottom: 1, left: 1 },
      align: "INSIDE",
      dash: true,
    });
  });

  // C-091: a shorthand resets every side, as CSS's does.
  it("resets every side with a shorthand", () => {
    expect(written({ outline: "1px solid #000" }, { "border-top": "4px solid #000" }).props.strokes).toMatchObject({
      weight: 1,
      align: "OUTSIDE",
    });
  });

  it("refuses border and outline together and sides that differ", () => {
    expect(written({ border: "1px solid #000", outline: "1px solid #000" }).problems).toEqual([
      {
        attribute: "outline",
        message: "Figma strokes a layer once: write border (inside) or outline (outside), not both.",
      },
    ]);
    expect(written({ "border-top": "1px dashed #000", "border-left": "1px solid #000" }).problems).toEqual([
      {
        attribute: "border-top",
        message: "Figma draws every side of a stroke in one colour and style: give the sides the same ones.",
      },
    ]);
    expect(written({ border: "thick" }).problems[0]?.message).toBe(
      'border="thick" is not "Npx solid|dashed <colour or token>".',
    );
  });
});
