import { describe, expect, it } from "vitest";
import { type CssContext, nodeCss, type Snapshot } from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";

const row = fixture("positivus-services-row");

function cssOf(snapshot: Snapshot, id: string, tokens = new Map<string, string>()) {
  const entry = nodesOf(snapshot).find(({ node }) => node.id === id);

  if (entry === undefined) {
    throw new Error(`no ${id} in the fixture`);
  }

  const context: CssContext = {
    styles: snapshot.styles,
    variables: snapshot.variables,
    tokens,
    root: snapshot.root,
  };

  return nodeCss(entry.node, entry.parent, context);
}

describe("CSS of the Positivus Services row", () => {
  it("gives the read root its size, and auto layout as flex without defaults", () => {
    expect(cssOf(row, "2:4869").properties).toEqual([
      ["display", "flex"],
      ["width", "1440px"],
      ["height", "310px"],
      ["padding", "0 100px"],
      ["gap", "40px"],
    ]);
  });

  it("writes styles as tokens, a fixed width, and the card's border, shadow and clipping", () => {
    const tokens = new Map<string, string>();

    expect(cssOf(row, "2:4870", tokens).properties).toEqual([
      ["display", "flex"],
      ["width", "600px"],
      ["padding", "50px"],
      ["justify-content", "space-between"],
      ["align-items", "center"],
      ["overflow", "hidden"],
      ["border-radius", "45px"],
      ["border", "1px solid var(--Dark)"],
      ["background", "var(--Grey)"],
      ["box-shadow", "0 5px 0 0 #191A23"],
    ]);
    expect(Object.fromEntries(tokens)).toEqual({
      "--Dark": "#191A23",
      "--Grey": "#F3F3F3",
    });
  });

  it("keeps a column's direction and leaves out a gap with nothing to space", () => {
    expect(cssOf(row, "2:4871").properties).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
      ["justify-content", "center"],
      ["gap", "93px"],
    ]);
    expect(cssOf(row, "I2:4872;330:291").properties).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
      ["padding", "0 7px"],
      ["border-radius", "7px"],
      ["background", "var(--Green)"],
    ]);
  });

  it("writes a styled text as only what its text style does not hold", () => {
    expect(cssOf(row, "I2:4872;330:292")).toEqual({
      properties: [["color", "#000"]],
      textStyle: "h3",
      readOnly: [],
    });
  });

  it("writes an unstyled text's font as one shorthand", () => {
    expect(cssOf(row, "I2:4873;334:1481").properties).toEqual([
      ["font", "400 20px/28px 'Space Grotesk'"],
      ["color", "var(--Black)"],
    ]);
  });

  it("places the children of a frame without auto layout absolutely, from the parent's corner", () => {
    expect(cssOf(row, "2:4874").properties).toEqual([
      ["width", "210px"],
      ["height", "170px"],
    ]);
    expect(cssOf(row, "2:4875").properties).toEqual(
      expect.arrayContaining([
        ["position", "absolute"],
        ["left", "0"],
        ["top", "2px"],
        ["width", "210px"],
        ["height", "166px"],
      ]),
    );
  });

  it("draws an ellipse round and places a rotated layer by its centre", () => {
    expect(cssOf(row, "I2:4873;334:1479").properties).toEqual([
      ["position", "absolute"],
      ["left", "0"],
      ["top", "0"],
      ["width", "41px"],
      ["height", "41px"],
      ["border-radius", "50%"],
      ["background", "var(--Dark)"],
    ]);
    expect(cssOf(row, "I2:4873;334:1480").properties).toEqual(
      expect.arrayContaining([
        ["left", "11px"],
        ["top", "21px"],
        ["transform", "rotate(-30deg)"],
      ]),
    );
  });
});

describe("CSS of a mirrored layer", () => {
  it("flips it instead of turning it upside down (Figma reports a horizontal flip as -180°)", () => {
    const block = fixture("positivus-services-block");

    expect(cssOf(block, "2:4893").properties).toEqual(expect.arrayContaining([["transform", "scaleX(-1)"]]));
  });
});
