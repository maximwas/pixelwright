import { describe, expect, it } from "vitest";
import {
  attributeOf,
  type DesignXmlOptions,
  designHints,
  designTree,
  elementsOf,
  type Snapshot,
  type SnapshotNode,
  type TextSegment,
} from "../src/index.ts";

const INTER = {
  family: "Inter",
  style: "Regular",
};

const segment = (characters: string, fields: Partial<TextSegment>): TextSegment => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: INTER,
  fontSize: 16,
  fontWeight: 400,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [],
  fillStyleId: "",
  textStyleId: "",
  ...fields,
});

/** A text of one run with an Auto line height, its box as Figma sizes it. */
const text = (
  id: string,
  characters: string,
  {
    resize,
    height,
    font = {},
    block = {},
  }: {
    resize: string;
    height: number;
    font?: Partial<TextSegment>;
    block?: Partial<NonNullable<SnapshotNode["text"]>>;
  },
): SnapshotNode => ({
  id,
  name: id,
  type: "TEXT",
  visible: true,
  x: 0,
  y: 0,
  width: 200,
  height,
  childCount: 0,
  text: {
    characters,
    textAutoResize: resize,
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    segments: [segment(characters, font)],
    ...block,
  },
});

/**
 * A card of texts: a label and a two-line title that hug their lines (Figma sizes them by their line height), a body
 * of a fixed width in the label's font and size, a caption in a size no hugging text shows, and a hugging text whose
 * leading is trimmed, which shows no line height.
 */
const CARD: Snapshot = {
  root: {
    id: "1:1",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    childCount: 5,
    layoutMode: "VERTICAL",
    children: [
      text("1:2", "Sign in", {
        resize: "WIDTH_AND_HEIGHT",
        height: 19,
      }),
      text("1:3", "Plans\nand prices", {
        resize: "WIDTH_AND_HEIGHT",
        height: 48.4,
        font: {
          fontName: {
            family: "Inter",
            style: "Medium",
          },
          fontSize: 20,
          fontWeight: 500,
        },
      }),
      text("1:4", "Every plan includes unlimited projects and a trial of Pro, so a team can start today.", {
        resize: "HEIGHT",
        height: 57,
        font: { textStyleId: "S:body" },
      }),
      text("1:5", "Billed yearly", {
        resize: "HEIGHT",
        height: 15,
        font: { fontSize: 12 },
      }),
      text("1:6", "New", {
        resize: "WIDTH_AND_HEIGHT",
        height: 9,
        font: { fontSize: 12 },
        block: { leadingTrim: "CAP_HEIGHT" },
      }),
    ],
  },
  styles: {
    "S:body": {
      name: "Body",
      type: "TEXT",
      remote: false,
      fontName: INTER,
      fontSize: 16,
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    },
  },
  variables: {},
};

/** Each text's font as the read writes it, by id, and the text styles it names. */
function fontsOf(options: DesignXmlOptions) {
  const tree = designTree(CARD, options);

  return {
    fonts: Object.fromEntries(
      elementsOf(tree.root)
        .filter((element) => element.tag === "Text")
        .map((element) => [element.id, attributeOf(element, "font")]),
    ),
    textStyles: tree.textStyles,
  };
}

describe("design_read autoLineHeight", () => {
  it('writes the px Figma renders an Auto line height at, where the read can tell, with "px"', () => {
    expect(fontsOf({ autoLineHeight: "px" })).toEqual({
      fonts: {
        "1:2": "400 16px/19px 'Inter'",
        "1:3": "500 20px/24.2px 'Inter'",
        "1:4": undefined,
        "1:5": "400 12px/normal 'Inter'",
        "1:6": "400 12px/normal 'Inter'",
      },
      textStyles: { Body: "400 16px/19px 'Inter'" },
    });
  });

  it("writes normal by default, as before", () => {
    expect(fontsOf({})).toEqual({
      fonts: {
        "1:2": "400 16px/normal 'Inter'",
        "1:3": "500 20px/normal 'Inter'",
        "1:4": undefined,
        "1:5": "400 12px/normal 'Inter'",
        "1:6": "400 12px/normal 'Inter'",
      },
      textStyles: { Body: "400 16px/normal 'Inter'" },
    });
  });

  it("names the option in the hint on Auto line heights", () => {
    expect(designHints(CARD).find((hint) => hint.includes("Auto line height"))).toContain('autoLineHeight: "px"');
  });
});
