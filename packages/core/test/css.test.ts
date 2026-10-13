import { describe, expect, it } from "vitest";
import { type CssContext, nodeCss, type Snapshot } from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";

const plans = fixture("orbit-plans");
const customers = fixture("orbit-customers");

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

describe("CSS of the Orbit Plans row", () => {
  it("gives the read root its size, and auto layout as flex without defaults", () => {
    expect(cssOf(plans, "54:243").properties).toEqual([
      ["display", "flex"],
      ["width", "1200px"],
      ["height", "394px"],
      ["gap", "var(--space-24)"],
    ]);
  });

  it("writes variables and an effect style as tokens, and the card's share of the row, border, radius and shadow", () => {
    const tokens = new Map<string, string>();

    expect(cssOf(plans, "54:268", tokens).properties).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
      ["flex", "1"],
      ["padding", "var(--space-32)"],
      ["gap", "var(--space-24)"],
      ["border-radius", "var(--radius-lg)"],
      ["border", "2px solid var(--color-brand)"],
      ["background", "var(--color-surface)"],
      ["box-shadow", "var(--Shadow-Card)"],
    ]);
    expect(Object.fromEntries(tokens)).toEqual({
      "--space-32": "32px",
      "--space-24": "24px",
      "--radius-lg": "24px",
      "--color-brand": "#3B2FD9",
      "--color-surface": "#FFF",
      "--Shadow-Card": "0 12px 32px -8px rgba(20, 22, 31, 0.12)",
    });
  });

  it("keeps a column's direction, clips what clips, and leaves out a gap with nothing to space", () => {
    expect(cssOf(plans, "I54:268;54:213").properties).toEqual([
      ["display", "flex"],
      ["flex-direction", "column"],
      ["align-self", "stretch"],
      ["gap", "var(--space-12)"],
      ["overflow", "hidden"],
    ]);
    // The badge spaces its children by 4 px and has one.
    expect(cssOf(plans, "I54:268;54:205").properties).toEqual([
      ["display", "flex"],
      ["padding", "var(--space-4) var(--space-12)"],
      ["align-items", "center"],
      ["border-radius", "var(--radius-pill)"],
      ["background", "var(--color-accent)"],
    ]);
  });

  it("writes a styled text as only what its text style does not hold", () => {
    expect(cssOf(plans, "I54:268;54:204")).toEqual({
      properties: [["color", "var(--color-ink)"]],
      textStyle: "Heading/H3",
      readOnly: [],
    });
  });
});

describe("CSS of the Orbit Customers frame", () => {
  it("writes an unstyled text's font as one shorthand", () => {
    expect(cssOf(customers, "54:436").properties).toEqual(
      expect.arrayContaining([
        ["font", "500 14px/normal 'Inter'"],
        ["color", "var(--color-ink-muted)"],
      ]),
    );
  });

  it("places the children of a frame without auto layout absolutely, from the parent's corner", () => {
    expect(cssOf(customers, "54:434").properties).toEqual([
      ["width", "1200px"],
      ["height", "360px"],
      ["overflow", "hidden"],
      ["border-radius", "24px"],
      ["background", "var(--color-surface)"],
    ]);
    expect(cssOf(customers, "54:435").properties).toEqual(
      expect.arrayContaining([
        ["position", "absolute"],
        ["left", "40px"],
        ["top", "40px"],
        ["width", "251px"],
        ["height", "30px"],
      ]),
    );
  });

  it("draws an ellipse round and places a rotated layer by its centre", () => {
    expect(cssOf(customers, "54:455").properties).toEqual([
      ["position", "absolute"],
      ["left", "0"],
      ["top", "0"],
      ["width", "56px"],
      ["height", "56px"],
      ["border-radius", "50%"],
      ["background", "#000"],
    ]);
    expect(cssOf(customers, "54:450").properties).toEqual(
      expect.arrayContaining([
        ["left", "521px"],
        ["top", "282px"],
        ["transform", "rotate(-8deg)"],
      ]),
    );
  });
});

describe("CSS of a mirrored layer", () => {
  it("flips it instead of turning it upside down (Figma reports a horizontal flip as -180°)", () => {
    expect(cssOf(customers, "54:452").properties).toEqual(expect.arrayContaining([["transform", "scaleX(-1)"]]));
  });
});
