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

  // 0.7.0's numbers (kernel/geometry coveredLength, centredAlong): a turned layer covers its turned box.
  it("measures how long a turned layer is along each axis of its parent", () => {
    const quarter = new LayerMatrix(layer.turned(90, false), { width: 100, height: 50 });
    const thirty = new LayerMatrix(layer.turned(30, false), { width: 100, height: 50 });

    expect([quarter.covered("horizontal"), quarter.covered("vertical")]).toEqual([50, 100]);
    expect([thirty.covered("horizontal"), thirty.covered("vertical")].map((length) => length.toFixed(2))).toEqual([
      "111.60",
      "93.30",
    ]);
  });

  it("moves a turned layer's centre along one axis", () => {
    const quarter = new LayerMatrix(layer.turned(90, false), { width: 100, height: 50 });

    expect(quarter.centredAlong("vertical", 60)).toEqual([
      [0, 1, 35],
      [-1, 0, 110],
    ]);
  });
});
