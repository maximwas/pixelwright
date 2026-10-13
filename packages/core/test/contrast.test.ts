import { describe, expect, it } from "vitest";
import { contrastCheck, type SnapshotNode, type TextSegment } from "../src/index.ts";

const solid = (r: number, g: number, b: number) => ({
  type: "SOLID",
  visible: true,
  color: {
    r: r / 255,
    g: g / 255,
    b: b / 255,
  },
});
const WHITE = solid(255, 255, 255);
const GRAY = solid(118, 118, 118);
const BLUE = solid(13, 153, 255);

const text = (id: string, size: number, x: number, y: number, fields: Partial<SnapshotNode> = {}): SnapshotNode => {
  const segment: TextSegment = {
    characters: id,
    start: 0,
    end: id.length,
    fontName: {
      family: "Inter",
      style: "Regular",
    },
    fontSize: size,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: {
      unit: "PIXELS",
      value: 0,
    },
    fills: [WHITE],
    fillStyleId: "",
    textStyleId: "",
  };

  return {
    id,
    name: id,
    type: "TEXT",
    visible: true,
    x,
    y,
    width: 100,
    height: size * 1.2,
    childCount: 0,
    text: {
      characters: id,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment],
    },
    ...fields,
  };
};

const frame = (id: string, fills: unknown[], children: SnapshotNode[], y = 0): SnapshotNode => ({
  id,
  name: id,
  type: "FRAME",
  visible: true,
  x: 0,
  y,
  width: 400,
  height: 100,
  childCount: children.length,
  fills: fills as SnapshotNode["fills"],
  children,
});

describe("contrast_check", () => {
  it("rates each text against the fill behind it, with the large-text rule", () => {
    const { texts } = contrastCheck({
      root: frame(
        "1:1",
        [WHITE],
        [
          frame("1:2", [GRAY], [text("Title", 24, 10, 10), text("Body", 14, 10, 50)]),
          frame("1:3", [BLUE], [text("Caption", 12, 10, 110)], 100),
        ],
      ),
      styles: {},
      variables: {},
    });

    expect(texts.map(({ name, ratio, large, aa, aaa }) => [name, ratio, large, aa, aaa])).toEqual([
      ["Title", 4.54, true, true, true],
      ["Body", 4.54, false, true, false],
      ["Caption", 2.99, false, false, false],
    ]);
    expect(texts[2]).toMatchObject({
      color: "#FFF",
      backdrop: "#0D99FF",
    });
  });

  it("says so when an image is behind a text, instead of guessing", () => {
    const { texts } = contrastCheck({
      root: frame(
        "1:1",
        [WHITE],
        [
          {
            id: "1:4",
            name: "Photo",
            type: "RECTANGLE",
            visible: true,
            x: 0,
            y: 0,
            width: 400,
            height: 100,
            childCount: 0,
            fills: [
              {
                type: "IMAGE",
                visible: true,
                imageHash: "a".repeat(40),
              },
            ],
          },
          text("Over", 16, 10, 10),
        ],
      ),
      styles: {},
      variables: {},
    });

    expect(texts[0]).toMatchObject({
      name: "Over",
      backdrop: "an image",
      ratio: null,
    });
  });
});
