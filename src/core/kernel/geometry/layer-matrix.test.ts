import { describe, expect, it } from "vitest";
import { LayerMatrix } from "@/core/kernel/geometry/layer-matrix.ts";

// A 100 x 50 layer at (10, 20): its centre is (60, 45) in its parent.
const layer = new LayerMatrix(
  [
    [1, 0, 10],
    [0, 1, 20],
  ],
  { width: 100, height: 50 },
);

describe("LayerMatrix", () => {
  // P-151: a turn is about the layer's centre, as CSS turns.
  it("turns a layer about its centre", () => {
    expect(layer.turned(90, false)).toEqual([
      [0, 1, 35],
      [-1, 0, 95],
    ]);
  });

  it("mirrors a layer about its centre", () => {
    expect(layer.turned(0, true)).toEqual([
      [-1, 0, 110],
      [0, 1, 20],
    ]);
  });

  it("moves the centre along one axis and keeps the other", () => {
    expect(layer.centredAlong("horizontal", 100)).toEqual([
      [1, 0, 50],
      [0, 1, 20],
    ]);
  });
});
