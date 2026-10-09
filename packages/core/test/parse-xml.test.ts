import { describe, expect, it } from "vitest";
import {
  type BridgeError,
  designXml,
  parseXml,
  type SnapshotNode,
  type TextSegment,
  type XmlChild,
  type XmlElementNode,
} from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

const elements = (children: readonly XmlChild[]) =>
  children.filter((child): child is XmlElementNode => child.kind === "element");

function errorOf(source: string): BridgeError {
  try {
    parseXml(source);
  } catch (error) {
    return error as BridgeError;
  }

  throw new Error("parsed");
}

describe("parseXml", () => {
  it("reads design_read's XML back: every attribute, $ names included, with lines", () => {
    const [root] = elements(parseXml(designXml(fixture("positivus-services-row")).xml));
    const [card] = elements(root?.children ?? []);

    expect(root).toMatchObject({
      type: "Frame",
      line: 1,
      column: 1,
      props: {
        id: "2:4869",
        gap: "40px",
      },
    });
    expect(card).toMatchObject({
      type: "Frame",
      line: 2,
      props: {
        id: "2:4870",
        border: "1px solid var(--Dark)",
      },
    });
    expect(elements(parseXml('<Frame id="1:1" $css="mix-blend-mode: multiply" $children="3"/>'))[0]?.props).toEqual({
      id: "1:1",
      $css: "mix-blend-mode: multiply",
      $children: "3",
    });
  });

  it("decodes entities and keeps text and spans in order, with the spaces between them", () => {
    const [text] = elements(
      parseXml(
        '<Text id="1:2">Fast &amp; <Span font="700 16px/normal \'Inter\'">&lt;free&gt;</Span> now&#10;ok</Text>',
      ),
    );

    expect(text?.children).toEqual([
      {
        kind: "text",
        value: "Fast & ",
        line: 1,
        column: 16,
      },
      expect.objectContaining({
        kind: "element",
        type: "Span",
        children: [expect.objectContaining({ value: "<free>" })],
      }),
      expect.objectContaining({
        kind: "text",
        value: " now\nok",
      }),
    ]);
  });

  it("reads back a text of spaces only that the writer encoded", () => {
    const run = (characters: string): TextSegment => ({
      characters,
      start: 0,
      end: characters.length,
      fontName: {
        family: "Inter",
        style: "Regular",
      },
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
    });
    const root: SnapshotNode = {
      id: "1:1",
      name: "Gap",
      type: "TEXT",
      visible: true,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      childCount: 0,
      text: {
        characters: "a b",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [
          {
            ...run("a"),
            end: 1,
          },
          {
            ...run(" "),
            start: 1,
            end: 2,
            fontWeight: 700,
            fontName: {
              family: "Inter",
              style: "Bold",
            },
          },
          {
            ...run("b"),
            start: 2,
            end: 3,
          },
        ],
      },
    };
    const [text] = elements(
      parseXml(
        designXml({
          root,
          styles: {},
          variables: {},
        }).xml,
      ),
    );
    const span = elements(text?.children ?? [])[0];

    expect(span?.children).toEqual([expect.objectContaining({ value: " " })]);
  });

  it("names the line and column of what is wrong", () => {
    const cases: [string, RegExp][] = [
      ['<Frame id="1:1">\n  <Text>Hi</Text>', /line 1, column 1.*<Frame> is not closed/],
      ["<Frame>\n  <Text>Hi</Frame>", /line 2, column 11.*Expected <\/Text>/],
      ['<Frame gap="1px" gap="2px"/>', /line 1, column 18.*gap is given twice/],
      ["<Frame gap=1px/>", /line 1, column 12.*needs quotes/],
      ["<Text>Fish & chips</Text>", /no entity/],
    ];

    for (const [source, message] of cases) {
      const error = errorOf(source);

      expect(error.code, source).toBe("INVALID_XML");
      expect(error.message, source).toMatch(message);
    }
  });
});
