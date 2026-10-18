import { describe, expect, it } from "vitest";
import { styleMismatches } from "../src/index.ts";

const CARD = {
  attributes: [
    ["display", "flex"],
    ["flex-direction", "column"],
    ["width", "320px"],
    ["padding", "var(--space-16) 24px"],
    ["gap", "8px"],
    ["border-radius", "12px"],
    ["background", "var(--surface)"],
    ["border", "1px solid var(--line)"],
    ["box-shadow", "0 12px 32px -8px rgba(20, 22, 31, 0.12)"],
  ] as const,
  tokens: {
    "--space-16": "16px",
    "--surface": "#FFF",
    "--line": "#E1E5EE",
  },
  textStyles: {},
};

/** A build's computed styles for the card, as getComputedStyle gives them. */
const BUILT = {
  display: "flex",
  "flex-direction": "column",
  width: "320.4px",
  "padding-top": "16px",
  "padding-right": "24px",
  "padding-bottom": "16px",
  "padding-left": "24px",
  "row-gap": "8px",
  "column-gap": "8px",
  "border-top-left-radius": "12px",
  "border-top-right-radius": "12px",
  "border-bottom-right-radius": "12px",
  "border-bottom-left-radius": "12px",
  "background-color": "rgb(255, 255, 255)",
  "border-top-width": "1px",
  "border-top-style": "solid",
  "border-top-color": "rgb(225, 229, 238)",
  "box-shadow": "rgba(20, 22, 31, 0.12) 0px 12px 32px -8px",
};

describe("a build's styles against the design's", () => {
  it("finds every style the same: tokens resolved, shorthands spread, colours and px compared by value", () => {
    expect(styleMismatches(CARD, BUILT, { tolerance: 1 })).toEqual({
      matched: 18,
      mismatches: [],
      notGiven: expect.arrayContaining(["border-right-width", "border-left-color"]),
      notCompared: [],
    });
  });

  it("names each style that differs with both values, a size past the tolerance, and the token it comes from", () => {
    const result = styleMismatches(
      CARD,
      {
        ...BUILT,
        width: "330px",
        "padding-left": "23px",
        "background-color": "rgb(250, 250, 250)",
        "flex-direction": "row",
      },
      { tolerance: 1 },
    );

    expect(result.mismatches).toEqual([
      {
        property: "flex-direction",
        design: "column",
        build: "row",
      },
      {
        property: "width",
        design: "320px",
        build: "330px",
      },
      {
        property: "padding-left",
        design: "24px",
        build: "23px",
      },
      {
        property: "background-color",
        design: "#FFF",
        from: "var(--surface)",
        build: "rgb(250, 250, 250)",
      },
    ]);
  });

  it("reads a text's style and its own font settings, and line height and letter spacing in px", () => {
    const text = {
      attributes: [
        ["textStyle", "Body"],
        ["color", "#14161F"],
        ["letter-spacing", "-0.02em"],
      ] as const,
      tokens: {},
      textStyles: { Body: "400 16px/24px 'Inter'; text-transform: uppercase" },
    };

    expect(
      styleMismatches(
        text,
        {
          "font-family": '"Inter", sans-serif',
          "font-size": "16px",
          "font-weight": "400",
          "line-height": "24px",
          "text-transform": "uppercase",
          "letter-spacing": "-0.32px",
          color: "rgb(20, 22, 31)",
        },
        { tolerance: 1 },
      ),
    ).toMatchObject({
      matched: 7,
      mismatches: [],
    });
    expect(
      styleMismatches(
        text,
        {
          "font-family": "Arial",
          "font-weight": "700",
        },
        { tolerance: 1 },
      ).mismatches,
    ).toEqual([
      {
        property: "font-family",
        design: "Inter",
        from: 'textStyle="Body"',
        build: "Arial",
      },
      {
        property: "font-weight",
        design: "400",
        from: 'textStyle="Body"',
        build: "700",
      },
    ]);
  });

  it("compares shadows, gradients and turns by value, and leaves out an offset a computed style holds in px", () => {
    const sticker = {
      attributes: [
        ["position", "absolute"],
        ["left", "calc(50% - 60px)"],
        ["transform", "rotate(-8deg)"],
        ["background", "linear-gradient(180deg, var(--from) 0%, #00F 100%)"],
        ["box-shadow", "inset 0 1px 2px #0000001A"],
      ] as const,
      tokens: { "--from": "#F00" },
      textStyles: {},
    };
    const result = styleMismatches(
      sticker,
      {
        position: "absolute",
        left: "540px",
        transform: "matrix(0.990268, -0.139173, 0.139173, 0.990268, 0, 0)",
        "background-image": "linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))",
        "box-shadow": "rgba(0, 0, 0, 0.1) 0px 1px 4px 0px inset",
      },
      { tolerance: 1 },
    );

    expect(result).toEqual({
      matched: 3,
      mismatches: [
        {
          property: "box-shadow",
          design: "inset 0 1px 2px #0000001A",
          build: "rgba(0, 0, 0, 0.1) 0px 1px 4px 0px inset",
        },
      ],
      notGiven: [],
      notCompared: [
        {
          property: "left",
          design: "calc(50% - 60px)",
        },
      ],
    });
  });
});
