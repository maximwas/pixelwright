import { describe, expect, it } from "vitest";
import { ClipCover, type CoverLayer } from "@/plugin/operations/cover/clip-cover.ts";

/** A visible, plain layer with an opaque fill and square corners, painting its own box. */
const layer = (
  id: string,
  [x, y, width, height]: readonly number[],
  own: Partial<CoverLayer> = {},
  children: readonly CoverLayer[] = [],
): CoverLayer => {
  const box = { x: x ?? 0, y: y ?? 0, width: width ?? 0, height: height ?? 0 };

  return {
    id,
    box,
    painted: box,
    visible: true,
    plain: true,
    mask: false,
    solid: true,
    radius: 0,
    children: () => children,
    ...own,
  };
};

// A long page: an opaque hero with a card, a see-through prices section holding an opaque board, a sticker laid over
// the hero's and the prices' corner, and a faded block.
const PAGE = layer("1:1", [0, 0, 1440, 8000], {}, [
  layer("1:2", [0, 0, 1440, 800], {}, [layer("1:3", [100, 100, 300, 200])]),
  layer("1:4", [0, 800, 1440, 900], { solid: false }, [layer("1:5", [60, 900, 600, 400])]),
  layer("1:6", [1300, 700, 100, 200]),
  layer("1:7", [0, 1800, 1440, 400], { plain: false }),
]);

const cover = (
  x: number,
  y: number,
  width: number,
  height: number,
) =>
  new ClipCover().cover(PAGE, { x, y, width, height });

describe("cover: the smallest layer that renders a region of a layer as the whole layer would (T-073)", () => {
  it("is the deepest opaque layer holding the region, placed from the layer's box", () => {
    expect(cover(200, 300, 400, 200)).toEqual({ node: "1:2", x: 0, y: 0, width: 1440, height: 800 });
    expect(cover(110, 110, 50, 50)).toEqual({ node: "1:3", x: 100, y: 100, width: 300, height: 200 });
  });

  it("looks through a see-through layer to an opaque one inside it", () => {
    expect(cover(100, 950, 100, 100)).toMatchObject({ node: "1:5" });
  });

  it("stays the layer itself when something painted later lies over the region, or the way down is faded", () => {
    expect(cover(1250, 650, 100, 100)).toMatchObject({ node: "1:1" });
    expect(cover(100, 1900, 100, 100)).toMatchObject({ node: "1:1" });
  });
});
