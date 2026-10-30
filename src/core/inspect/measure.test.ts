import { describe, expect, it } from "vitest";
import { Measure } from "@/core/inspect/measure.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const measure = new Measure(new NumberFormat());

type Box = { x: number; y: number; width: number; height: number };

/** A layer as inspect gives its boxes, in page px. */
const at = (
  id: string,
  box: Box,
  paintedBox: Box | null = null,
) => ({
  id,
  name: id === "1:1" ? "Card" : id === "1:2" ? "Badge" : "Price",
  box,
  paintedBox,
});

// T-084, K-061: each layer from the one before; gaps, edges and centres, insets, painted boxes.
describe("measure", () => {
  it("gives the gap between two layers side by side and which edges line up", () => {
    const [pair] = measure.pairs(
      [at("1:1", { x: 0, y: 0, width: 100, height: 50 }), at("1:2", { x: 124, y: 0, width: 100, height: 50 })],
      false,
    );

    expect(pair).toMatchObject({ gap: { x: 24, y: -50 }, edges: { left: 124, top: 0, bottom: 0, centerY: 0 } });
    expect(pair?.summary).toBe('1:2 "Badge" is 24 px right of 1:1 "Card"; tops, bottoms and centres (y) aligned.');
  });

  it("gives the inset from each edge when one layer sits inside the other", () => {
    const [pair] = measure.pairs(
      [at("1:1", { x: 0, y: 0, width: 200, height: 100 }), at("1:2", { x: 16, y: 24, width: 100, height: 50 })],
      false,
    );

    expect(pair).toMatchObject({ contains: "a", inset: { top: 24, right: 84, bottom: 26, left: 16 } });
    expect(pair?.summary).toMatch(/inside 1:1 "Card": 24 px from its top, 84 from its right, 26 from its bottom/);
  });

  it("measures a row in order, each layer from the one before", () => {
    const pairs = measure.pairs(
      [
        at("1:1", { x: 0, y: 0, width: 100, height: 50 }),
        at("1:2", { x: 0, y: 66, width: 100, height: 50 }),
        at("1:3", { x: 0, y: 140, width: 100, height: 50 }),
      ],
      false,
    );

    expect(pairs.map((pair) => [pair.a.id, pair.b.id, pair.gap.y])).toEqual([
      ["1:1", "1:2", 16],
      ["1:2", "1:3", 24],
    ]);
  });

  it("measures what is painted when asked: a centred stroke reaches half a pixel out", () => {
    const [pair] = measure.pairs(
      [
        at("1:1", { x: 0, y: 0, width: 100, height: 0 }, { x: -0.5, y: -0.5, width: 101, height: 1 }),
        at("1:2", { x: 0, y: 10, width: 100, height: 20 }),
      ],
      true,
    );

    expect(pair?.gap.y).toBe(9.5);
  });
});
