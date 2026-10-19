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

/** A text whose every run is painted with one fill. */
const painted = (node: SnapshotNode, fill: unknown): SnapshotNode => ({
  ...node,
  text: {
    ...(node.text as NonNullable<SnapshotNode["text"]>),
    segments: (node.text?.segments ?? []).map((segment) => ({
      ...segment,
      fills: [fill] as TextSegment["fills"],
    })),
  },
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
  it("looks past the layer read into the layers above it, rating only the read's own texts (bug 6)", () => {
    const content = frame("Content", [], [painted(text("Account", 16, 10, 10), solid(142, 142, 147))]);
    const bare: SnapshotNode = {
      ...content,
      children: undefined,
    };
    const { summary, texts } = contrastCheck({
      root: content,
      ancestors: [frame("Screen", [solid(0, 0, 0)], [text("Title", 16, 10, 10), bare])],
      styles: {},
      variables: {},
    });

    expect(texts).toEqual([
      expect.objectContaining({
        name: "Account",
        backdrop: "#000",
        ratio: 6.44,
      }),
    ]);
    expect(summary).toBe("1 texts: 0 below AA.");
  });

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
    expect(summary).toBe("2 texts: 1 below AA. Left out as not visible: 1 cut off by a clipping frame.");
  });

  it("counts each reason a contrast is not one number on its own line (bug 11)", () => {
    const photo = {
      ...rect(
        "Photo",
        [
          {
            type: "IMAGE",
            visible: true,
          },
        ],
        0,
        400,
      ),
      y: 100,
    };
    const strip = {
      ...rect("Strip", [DARK], 12, 98),
      y: 300,
    };
    const { summary } = contrastCheck({
      root: frame(
        "1:1",
        [],
        [
          frame("Card", [DARK], [text("Fine", 16, 10, 10)]),
          photo,
          text("Over", 16, 10, 110),
          frame("Bare", [], [text("Air", 16, 10, 210)], 200),
          frame("Half", [WHITE], [strip, text("Half", 16, 10, 310)], 300),
        ],
      ),
      styles: {},
      variables: {},
    });

    expect(summary).toBe(
      "4 texts: 0 below AA, 1 over an image or gradient (check those by eye), 1 partly over another layer (check those by eye), 1 with nothing opaque behind it in the read (check those inside their screen).",
    );
  });

  it("lays a see-through layer over a text (a scrim) on the text and its backdrop alike; an opaque one hides it (bug 10)", () => {
    const scrim = rect(
      "Scrim",
      [
        {
          ...solid(0, 0, 0),
          opacity: 0.4,
        },
      ],
      0,
      400,
    );
    const sheet = {
      ...rect("Sheet", [WHITE], 0, 400),
      y: 50,
      height: 50,
    };
    const rows = [painted(text("Row", 16, 10, 10), GRAY), painted(text("Under", 16, 10, 60), GRAY)];
    const { summary, texts } = contrastCheck({
      root: frame("1:1", [WHITE], [...rows, scrim, sheet]),
      styles: {},
      variables: {},
    });

    expect(texts).toEqual([
      expect.objectContaining({
        name: "Row",
        ratio: 3.27,
        aa: false,
        backdrop: expect.stringMatching(/^#FFF under Scrim "Scrim"/),
      }),
    ]);
    expect(summary).toBe(
      "1 texts: 1 below AA, 1 under a see-through layer (a scrim: content behind a modal may be exempt). Left out as not visible: 1 hidden under an opaque layer.",
    );
  });

  it("rates every run with a colour of its own, so a link inside legal text is checked", () => {
    const legal = painted(text("Legal", 14, 10, 10), GRAY);
    const [run] = legal.text?.segments ?? [];
    const runs = [
      ["By continuing you agree to the ", GRAY],
      ["Terms", BLUE],
      [".", GRAY],
    ] as const;
    let start = 0;
    const segments = runs.map(([characters, fill]) => {
      start += characters.length;

      return {
        ...(run as TextSegment),
        characters,
        start: start - characters.length,
        end: start,
        fills: [fill] as TextSegment["fills"],
      };
    });
    const { summary, texts } = contrastCheck({
      root: frame(
        "1:1",
        [WHITE],
        [
          {
            ...legal,
            text: {
              ...(legal.text as NonNullable<SnapshotNode["text"]>),
              characters: runs.map(([characters]) => characters).join(""),
              segments,
            },
          },
        ],
      ),
      styles: {},
      variables: {},
    });

    expect(texts.map(({ text: characters, color, ratio }) => [characters, color, ratio])).toEqual([
      ["By continuing you agree to the ", "#767676", 4.54],
      ["Terms", "#0D99FF", 2.99],
    ]);
    expect(summary).toBe("1 texts: 1 below AA.");
  });

  it("rates a text on see-through glass over mixed rows against the worst of them, the blur not weighed", () => {
    const row = (id: string, fill: unknown, y: number, height: number) => ({
      ...rect(id, [fill], 0, 400),
      y,
      height,
    });
    const glass = {
      ...rect(
        "Glass",
        [
          {
            ...WHITE,
            opacity: 0.7,
          },
        ],
        0,
        400,
      ),
      effects: [
        {
          type: "BACKGROUND_BLUR",
          visible: true,
          radius: 20,
        },
      ],
    };
    const rows = [row("Row 1", solid(255, 59, 48), 0, 15), row("Row 2", WHITE, 15, 85)];
    const { summary, texts } = contrastCheck({
      root: frame("1:1", [WHITE], [...rows, glass, painted(text("Label", 16, 10, 10), GRAY)]),
      styles: {},
      variables: {},
    });

    expect(texts[0]).toMatchObject({
      ratio: 3.01,
      aa: false,
      backdrop: expect.stringMatching(/^#FFC4C1 \(the worst of 2 /),
    });
    expect(summary).toBe("1 texts: 1 below AA.");
  });
});

describe("contrast_check on a read cut at its size budget (live check)", () => {
  const card = frame("Card", [], [painted(text("Label", 16, 10, 10), DARK)]);
  const bare: SnapshotNode = {
    ...card,
    childCount: 1,
    children: undefined,
  };
  // An ancestor's entry holds only the children that overlap the root, and the root's bare place, by design.
  const screen = (children: SnapshotNode[]): SnapshotNode => ({
    ...frame("Screen", [WHITE], children),
    childCount: 5,
  });
  const decor = (childCount: number): SnapshotNode => ({
    ...frame("Decor", [], [rect("Dot 1", [GRAY], 300, 12)]),
    childCount,
  });
  const summaryOf = (root: SnapshotNode, ancestors: SnapshotNode[]) =>
    contrastCheck({
      root,
      ancestors,
      styles: {},
      variables: {},
    }).summary;

  it("says the layers behind or over a text were not all read, so its backdrop may be wrong", () => {
    expect(summaryOf(card, [screen([decor(8000), bare])])).toBe(
      'Incomplete: the read stopped at its size budget, so 1 layer behind or over it was read without all its children (first Decor "Decor"): the backdrops may be wrong; check them in a screenshot. 1 texts: 0 below AA.',
    );
  });

  it("says the texts of layers inside the read whose children did not fit are missing", () => {
    const cut: SnapshotNode = {
      ...frame("1:1", [WHITE], [painted(text("Title", 16, 10, 10), DARK)]),
      childCount: 40,
    };

    expect(summaryOf(cut, [])).toBe(
      'Incomplete: the read stopped at its size budget, so 1 layer in it was read without all its children (first 1:1 "1:1"): their texts are missing; check smaller parts of it. 1 texts: 0 below AA.',
    );
  });

  it("adds nothing when the read is whole, the layers above holding only what overlaps it", () => {
    expect(summaryOf(card, [screen([decor(1), bare])])).toBe("1 texts: 0 below AA.");
  });
});
