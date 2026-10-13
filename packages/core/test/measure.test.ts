import { describe, expect, it } from "vitest";
import { measureLayers } from "../src/index.ts";

/** Layers as inspect gives their boxes, in page px. */
const at = (id: string, x: number, y: number, width: number, height: number, painted = null) => ({
  id,
  name: id === "1:1" ? "Card" : id === "1:2" ? "Badge" : "Price",
  box: {
    x,
    y,
    width,
    height,
  },
  paintedBox: painted,
});

describe("measure", () => {
  it("gives the gap between two layers side by side and which edges line up", () => {
    const [pair] = measureLayers([at("1:1", 0, 0, 100, 50), at("1:2", 124, 0, 100, 50)], false).pairs;

    expect(pair).toMatchObject({
      gap: {
        x: 24,
        y: -50,
      },
      edges: {
        left: 124,
        top: 0,
        bottom: 0,
        centerY: 0,
      },
    });
    expect(pair?.summary).toBe('1:2 "Badge" is 24 px right of 1:1 "Card"; tops, bottoms and centres (y) aligned.');
  });

  it("gives the inset from each edge when one layer sits inside the other", () => {
    const [pair] = measureLayers([at("1:1", 0, 0, 200, 100), at("1:2", 16, 24, 100, 50)], false).pairs;

    expect(pair).toMatchObject({
      contains: "a",
      inset: {
        top: 24,
        right: 84,
        bottom: 26,
        left: 16,
      },
    });
    expect(pair?.summary).toMatch(/inside 1:1 "Card": 24 px from its top, 84 from its right, 26 from its bottom/);
  });

  it("measures a row in order, each layer from the one before", () => {
    const { pairs } = measureLayers(
      [at("1:1", 0, 0, 100, 50), at("1:2", 0, 66, 100, 50), at("1:3", 0, 140, 100, 50)],
      false,
    );

    expect(pairs.map((pair) => [pair.a.id, pair.b.id, pair.gap.y])).toEqual([
      ["1:1", "1:2", 16],
      ["1:2", "1:3", 24],
    ]);
  });

  it("measures what is painted when asked: a centred stroke reaches half a pixel out", () => {
    const [pair] = measureLayers(
      [
        at("1:1", 0, 0, 100, 0, {
          x: -0.5,
          y: -0.5,
          width: 101,
          height: 1,
        } as never),
        at("1:2", 0, 10, 100, 20),
      ],
      true,
    ).pairs;

    expect(pair?.gap.y).toBe(9.5);
  });
});
