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

const DARK = solid(18, 18, 18);
const rect = (id: string, fills: unknown[], x: number, width: number): SnapshotNode => ({
  id,
  name: id,
  type: "RECTANGLE",
  visible: true,
  x,
  y: 0,
  width,
  height: 100,
  childCount: 0,
  fills: fills as SnapshotNode["fills"],
});
const check = (root: SnapshotNode) =>
  contrastCheck({
    root,
    styles: {},
    variables: {},
  }).texts[0];

describe("contrast_check after the review", () => {
  it("finds a backdrop nested inside a layer below the text", () => {
    expect(
      check(frame("1:1", [], [frame("1:2", [], [rect("1:3", [DARK], 0, 400)]), text("Over", 16, 10, 10)])),
    ).toMatchObject({
      backdrop: "#121212",
      aa: true,
    });
  });

  it("does not take white for granted when nothing opaque is behind the text in what was read", () => {
    expect(check(frame("1:1", [], [text("Over", 16, 10, 10)]))).toMatchObject({
      ratio: null,
      backdrop: expect.stringMatching(/nothing opaque/),
    });
  });

  it("says when a layer behind covers only part of the text", () => {
    expect(check(frame("1:1", [WHITE], [rect("1:4", [DARK], 12, 98), text("Over", 16, 10, 10)]))).toMatchObject({
      ratio: null,
      backdrop: expect.stringMatching(/partly over 1:4/),
    });
  });

  it("lists a text painted with a gradient, its contrast unknown", () => {
    expect(
      check(
        frame(
          "1:1",
          [WHITE],
          [
            text("Shine", 16, 10, 10, {
              text: {
                ...(text("Shine", 16, 10, 10).text as NonNullable<SnapshotNode["text"]>),
                segments: [
                  {
                    ...((text("Shine", 16, 10, 10).text as NonNullable<SnapshotNode["text"]>)
                      .segments[0] as TextSegment),
                    fills: [
                      {
                        type: "GRADIENT_LINEAR",
                        visible: true,
                      },
                    ],
                  },
                ],
              },
            }),
          ],
        ),
      ),
    ).toMatchObject({
      name: "Shine",
      color: "a gradient",
      ratio: null,
    });
  });
});

describe("contrast_check on the Dukach feedback", () => {
  it("never takes a text lower in the frame for a backdrop (bug 8)", () => {
    const row = (id: string, x: number) => text(id, 16, x, 10, { fills: [GRAY] as SnapshotNode["fills"] });
    const { texts } = contrastCheck({
      root: frame("1:1", [DARK], [row("Row", 10), row("Footer", 12), text("Tab", 16, 10, 10)]),
      styles: {},
      variables: {},
    });

    expect(texts.find(({ name }) => name === "Tab")).toMatchObject({
      backdrop: "#121212",
      aa: true,
    });
  });

  it("stops at the solid fill right under a text: deeper layers that cover part of it are hidden (bug 7)", () => {
    const partly = rect("Tab 1", [GRAY], 12, 98);
    const onDark = {
      backdrop: "#121212",
      aa: true,
    };

    const capsule = frame("Capsule", [DARK], [text("Cancel", 16, 10, 10)]);

    expect(check(frame("1:1", [WHITE], [partly, capsule]))).toMatchObject(onDark);
    expect(check(frame("1:1", [WHITE], [partly, rect("Bar", [DARK], 0, 400), text("9:41", 16, 10, 10)]))).toMatchObject(
      onDark,
    );
  });

  it("leaves out a text a clipping frame cuts out of view, and says so (bug 9)", () => {
    const scroll = {
      ...frame("Scroll", [DARK], [text("Shown", 16, 10, 10), text("Note", 16, 10, 150)]),
      clipsContent: true,
    };
    const unclipped = frame("Free", [WHITE], [text("Below", 16, 10, 150)], 200);
    const { summary, texts } = contrastCheck({
      root: frame("1:1", [GRAY], [scroll, unclipped]),
      styles: {},
      variables: {},
    });

    expect(texts.map(({ name }) => name)).toEqual(["Shown", "Below"]);
    expect(summary).toBe("2 texts: 1 below AA. 1 text cut off by a clipping frame is left out.");
  });
});
