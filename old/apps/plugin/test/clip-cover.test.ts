import { beforeEach, describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const SOLID = {
  type: "SOLID",
  color: {
    r: 0.9,
    g: 0.9,
    b: 0.9,
  },
};
const box = (x: number, y: number, width: number, height: number) => ({
  absoluteBoundingBox: {
    x,
    y,
    width,
    height,
  },
  width,
  height,
});

beforeEach(() => {
  // A long page: an opaque hero with a card, a see-through prices section holding an opaque board, a sticker laid
  // over the hero's and the prices' corner, and a faded block.
  const page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Page",
        fills: [SOLID],
        ...box(0, 0, 1440, 8000),
        children: [
          {
            id: "1:2",
            name: "Hero",
            fills: [SOLID],
            ...box(0, 0, 1440, 800),
            children: [
              {
                id: "1:3",
                name: "Card",
                fills: [SOLID],
                cornerRadius: 0,
                ...box(100, 100, 300, 200),
              },
            ],
          },
          {
            id: "1:4",
            name: "Prices",
            fills: [],
            ...box(0, 800, 1440, 900),
            children: [
              {
                id: "1:5",
                type: "RECTANGLE",
                name: "Board",
                fills: [SOLID],
                ...box(60, 900, 600, 400),
              },
            ],
          },
          {
            id: "1:6",
            name: "Sticker",
            fills: [SOLID],
            ...box(1300, 700, 100, 200),
          },
          {
            id: "1:7",
            name: "Faded",
            fills: [SOLID],
            opacity: 0.5,
            ...box(0, 1800, 1440, 400),
          },
        ],
      },
    ],
  });

  installFigma(page);
});

const cover = async (clip: { x: number; y: number; width: number; height: number }) =>
  await plugin.run("cover", {
    node: "1:1",
    clip,
  });

describe("cover: the smallest layer that renders a region of a layer as the whole layer would", () => {
  it("is the deepest opaque layer holding the region, placed from the layer's box", async () => {
    expect(
      await cover({
        x: 200,
        y: 300,
        width: 400,
        height: 200,
      }),
    ).toEqual({
      node: "1:2",
      x: 0,
      y: 0,
      width: 1440,
      height: 800,
    });
    expect(
      await cover({
        x: 110,
        y: 110,
        width: 50,
        height: 50,
      }),
    ).toEqual({
      node: "1:3",
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
  });

  it("looks through a see-through layer to an opaque one inside it", async () => {
    expect(
      await cover({
        x: 100,
        y: 950,
        width: 100,
        height: 100,
      }),
    ).toMatchObject({ node: "1:5" });
  });

  it("stays the layer itself when something painted later lies over the region, or the way down is faded", async () => {
    expect(
      await cover({
        x: 1250,
        y: 650,
        width: 100,
        height: 100,
      }),
    ).toMatchObject({ node: "1:1" });
    expect(
      await cover({
        x: 100,
        y: 1900,
        width: 100,
        height: 100,
      }),
    ).toMatchObject({ node: "1:1" });
  });
});
