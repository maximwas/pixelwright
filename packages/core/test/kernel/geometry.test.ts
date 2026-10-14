import { describe, expect, it } from "vitest";
import { centredAlong, coveredLength, differs, type Matrix, snapped, turnedAbout } from "../../src/index.ts";

const at = (x: number, y: number): Matrix => [
  [1, 0, x],
  [0, 1, y],
];
const box = {
  width: 100,
  height: 50,
};

describe("geometry", () => {
  it("turns and mirrors a layer about its centre, a quarter turn landing on whole values", () => {
    expect(turnedAbout(at(10, 20), box, 90, false)).toEqual([
      [0, 1, 35],
      [-1, 0, 95],
    ]);
    expect(turnedAbout(at(10, 20), box, 0, true)).toEqual([
      [-1, 0, 110],
      [0, 1, 20],
    ]);
  });

  it("moves a layer's centre along one axis and keeps the other", () => {
    expect(centredAlong(at(10, 20), box, "horizontal", 200)).toEqual(at(150, 20));
    expect(centredAlong(at(10, 20), box, "vertical", 100)).toEqual(at(10, 75));
  });

  it("measures how long a turned box is along each axis", () => {
    const quarter: Matrix = [
      [0, 1, 0],
      [-1, 0, 0],
    ];

    expect([coveredLength(quarter, box, "horizontal"), coveredLength(quarter, box, "vertical")]).toEqual([50, 100]);
  });

  it("snaps float noise to zero and tells a change from Figma's noise", () => {
    expect([snapped(1e-11), snapped(1e-9)]).toEqual([0, 1e-9]);
    expect(
      differs(at(10, 20), [
        [1, 0, 10 + 1e-7],
        [0, 1, 20],
      ]),
    ).toBe(false);
    expect(
      differs(at(10, 20), [
        [1, 0, 10.001],
        [0, 1, 20],
      ]),
    ).toBe(true);
  });
});
