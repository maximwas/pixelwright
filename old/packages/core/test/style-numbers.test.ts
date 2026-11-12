import { describe, expect, it } from "vitest";
import { designXml, type RawTokens, type SnapshotNode, styleNumbers, tokenModel } from "../src/index.ts";

/** #0F0F0F and #141414: the two Blacks a real file had. */
const BLACK = {
  r: 15 / 255,
  g: 15 / 255,
  b: 15 / 255,
};
const NEAR_BLACK = {
  r: 20 / 255,
  g: 20 / 255,
  b: 20 / 255,
};

const paintStyle = (color: typeof BLACK, duplicate?: number) => ({
  name: "Black",
  type: "PAINT",
  remote: false,
  paints: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      color,
    },
  ],
  ...(duplicate === undefined ? {} : { duplicate }),
});

const layer = (id: string, color: typeof BLACK, style: string, children: SnapshotNode[] = []): SnapshotNode => ({
  id,
  name: id,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: children.length,
  fills: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      color,
    },
  ],
  fillStyleId: style,
  children,
});

describe("styles that share a name", () => {
  it("are numbered by kind and name: the file's own by id, then library ones", () => {
    const numbers = styleNumbers([
      {
        id: "S:2",
        type: "PAINT",
        name: "Black",
        remote: false,
      },
      {
        id: "S:1",
        type: "PAINT",
        name: "Black",
        remote: false,
      },
      {
        id: "S:0",
        type: "PAINT",
        name: "Black",
        remote: true,
      },
      {
        id: "S:3",
        type: "TEXT",
        name: "Black",
        remote: false,
      },
      {
        id: "S:4",
        type: "PAINT",
        name: "White",
        remote: false,
      },
    ]);

    expect([...numbers]).toEqual([
      ["S:1", 1],
      ["S:2", 2],
      ["S:0", 3],
    ]);
  });

  it("each keep their own token in design_read", () => {
    const read = designXml({
      root: layer("1:1", BLACK, "S:1", [layer("1:2", NEAR_BLACK, "S:2")]),
      styles: {
        "S:1": paintStyle(BLACK),
        "S:2": paintStyle(NEAR_BLACK, 2),
      },
      variables: {},
    });

    expect(read.tokens).toEqual({
      "--Black": "#0F0F0F",
      "--Black-2": "#141414",
    });
    expect(read.xml).toContain('background="var(--Black-2)"');
  });

  it("are named apart and noted in tokens_read", () => {
    const raw: RawTokens = {
      collections: [],
      variables: [],
      external: {},
      styles: [
        {
          id: "S:1",
          ...paintStyle(BLACK),
        },
        {
          id: "S:2",
          ...paintStyle(NEAR_BLACK, 2),
        },
      ],
    };
    const model = tokenModel(raw);

    expect(model.styles.paint.map(({ token, value }) => [token, value])).toEqual([
      ["--Black", "#0F0F0F"],
      ["--Black-2", "#141414"],
    ]);
    expect(model.notes).toContainEqual(expect.stringMatching(/Black.*--Black #0F0F0F.*--Black-2 #141414/));
  });
});
