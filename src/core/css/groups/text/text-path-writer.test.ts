import { describe, expect, it } from "vitest";
import { FontValues } from "@/core/css/fonts/font-values.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { FillsWriter } from "@/core/css/groups/paint/fills-writer.ts";
import { PathGeometry } from "@/core/css/groups/text/path-geometry.ts";
import { TextPathWriter } from "@/core/css/groups/text/text-path-writer.ts";
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
const paths = new PathGeometry(new CssAngle());
const fills = new FillsWriter(
  new PaintValue(vars),
  new GradientParser(split, vars, new GradientGeometry(), new CssAngle()),
  new CssUrl(split),
  split,
);
const text = new TextWriter(
  fills,
  new FontValues(new CssLength(vars, format, new TokenNames()), format, split),
  split,
  paths,
);
const path = new TextPathWriter(paths);

/** The arc design_read writes for a label over a circle's top: one curve, 200 px wide. */
const ARC = "M 0 50 C 55.23 -16.67 144.77 -16.67 200 50";

/** What both TextPath writers set for a TextPath's attributes, on a new one or one there (with `now`, its d). */
function written(attributes: Readonly<Record<string, string>>, now?: string) {
  const out = new ChangeOutput();
  const input = {
    tag: "TextPath",
    own: (name: string) => attributes[name],
    merged: (name: string) => attributes[name] ?? (name === "d" ? now : undefined),
    changed: (name: string) => attributes[name] !== undefined,
    hidden: false,
    existing: now !== undefined,
  };

  for (const writer of [path, text]) {
    if (writer.attributes.some(input.changed)) {
      writer.write(input, out);
    }
  }

  return { props: out.props, problems: out.problems };
}

describe("TextPathWriter", () => {
  // T-140: a new TextPath is made along its d, as Figma's vector data takes it.
  it("makes a new one along its d, absolute and spaced", () => {
    expect(written({ d: "M0,0 l10-5 H 30 V 0 z" }).props).toEqual({ path: "M 0 0 L 10 -5 L 30 -5 L 30 0 Z" });
  });

  // T-140: Figma keeps the path a text on a path was made along, so a d change is refused, not dropped.
  it("refuses a d change on one there", () => {
    expect(written({ d: "M 0 0 L 100 0" }, ARC).problems).toEqual([
      {
        attribute: "d",
        message: "d is the path this <TextPath> was made along: it stays as it is.",
        hint: "Figma cannot change a text path's path: delete it and make it again.",
      },
    ]);
  });

  // T-140: arc="cx cy r from to" draws the arc in its own box, placed where the box sits in the parent.
  it("draws an arc in the box it covers and places it there", () => {
    const { props } = written({ arc: "200 200 100 -90 90" });

    expect(props).toMatchObject({
      absolute: true,
      horizontal: { kind: "MIN", offset: 100 },
      vertical: { kind: "MIN", offset: 100 },
    });
    expect(props.path?.startsWith("M 0 100 C")).toBe(true);
  });

  it("moves the start, and refuses one that is no segment and place", () => {
    expect(written({ start: "0 0.25" }, ARC).props).toEqual({ pathStart: { segment: 0, position: 0.25 } });
    expect(written({ start: "1.5 2" }, ARC).problems.map(({ attribute }) => attribute)).toEqual(["start"]);
  });

  // B-032: centre or right from start "0 0" drew one glyph, so text-align with no start moves the start by length.
  it.each([
    ['arc="200 200 100 -135 135"', { arc: "200 200 100 -135 135" }, { segment: 1, position: 0.5 }],
    ["two lines of 100 and 300 px", { d: "M 0 0 L 100 0 L 100 300" }, { segment: 1, position: 0.3333 }],
    ["x = 300 t\u00b3, its middle at t 0.7937", { d: "M 0 0 C 0 0 0 0 300 0" }, { segment: 0, position: 0.7937 }],
  ])("anchors a new one's text-align center at its middle by length: %s", (_name, attributes, start) => {
    expect(written({ ...attributes, "text-align": "center" }).props.pathStart).toEqual(start);
  });

  it("moves one there to its end for text-align right, unless a start is given", () => {
    expect(written({ "text-align": "right" }, ARC).props.pathStart).toEqual({ segment: 0, position: 1 });
    expect(written({ "text-align": "right", start: "0 0.25" }, ARC).props.pathStart).toEqual({
      segment: 0,
      position: 0.25,
    });
  });
});
