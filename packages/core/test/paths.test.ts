import { describe, expect, it } from "vitest";
import { arcPath, figmaPath, pathData } from "../src/css-mapping/values/paths.ts";

/** The numbers of a path's data, for comparing within a rounding. */
const numbers = (d: string) =>
  d
    .split(" ")
    .filter((part) => !/^[A-Z]$/.test(part))
    .map(Number);

describe("a text on a path's path", () => {
  it("reads Figma's paths as one d, to two decimals", () => {
    expect(
      pathData([{ data: "M 0 50 C 55.228 -16.667 144.772 -16.667 200.0004 50" }, { data: "M 0 60 L 200 60 Z" }]),
    ).toBe("M 0 50 C 55.23 -16.67 144.77 -16.67 200 50 M 0 60 L 200 60 Z");
  });

  it("writes any SVG path as Figma's data: absolute, spaced, shorthands and arcs drawn out", () => {
    expect(figmaPath("M0,0 l10-5 H 30 V 0 z")).toBe("M 0 0 L 10 -5 L 30 -5 L 30 0 Z");
    expect(figmaPath("M 0 0 A 50 50 0 0 1 100 0")).toMatch(/^M 0 0(?: C(?: -?[\d.]+){6})+$/);
    expect(figmaPath("M 0 0 A 50 50 0 0 1 100 0")?.endsWith(" 100 0")).toBe(true);
  });

  it("is no path when it draws nothing or is not SVG", () => {
    for (const d of ["", "M 10 10", "M 0 0 X 5", "circle"]) {
      expect(figmaPath(d)).toBeNull();
    }
  });

  it("draws an arc as CSS turns, 0 at the top and clockwise, in the box it covers", () => {
    // A quarter from the top to the right of a circle of 100 around 200, 200.
    const quarter = arcPath(200, 200, 100, [0, 90]);

    expect(quarter).toMatchObject({
      x: 200,
      y: 100,
    });
    expect(numbers(quarter?.d ?? "")).toEqual([0, 0, 55.228, 0, 100, 44.772, 100, 100]);

    // A smaller end runs back: from the right of the circle to its top, counter-clockwise.
    expect(arcPath(200, 200, 100, [90, 0])?.d.startsWith("M 100 100 C")).toBe(true);
  });

  it("draws more than half a circle the long way, and a whole circle back to its start", () => {
    // Three quarters over the top: the box reaches the circle's top and both sides, not its bottom. Figma draws
    // arcs as cubic curves, which pass the circle by a hundredth of a pixel here.
    const wide = arcPath(0, 0, 10, [-135, 135]);

    expect(wide?.x).toBeCloseTo(-10, 1);
    expect(wide?.y).toBeCloseTo(-10, 1);
    expect(numbers(wide?.d ?? "").slice(0, 2)).toEqual([expect.closeTo(2.93, 1), expect.closeTo(17.07, 1)]);
    expect(numbers(wide?.d ?? "").slice(-2)).toEqual([expect.closeTo(17.07, 1), expect.closeTo(17.07, 1)]);

    const circle = arcPath(0, 0, 10, [0, 360]);

    expect(circle?.x).toBeCloseTo(-10, 1);
    expect(circle?.y).toBeCloseTo(-10, 1);
    expect(numbers(circle?.d ?? "").slice(0, 2)).toEqual([expect.closeTo(10, 1), expect.closeTo(0, 1)]);
    expect(numbers(circle?.d ?? "").slice(-2)).toEqual([expect.closeTo(10, 1), expect.closeTo(0, 1)]);
  });

  it("is no arc without a radius or a turn, or past a whole circle", () => {
    expect(arcPath(0, 0, 0, [0, 90])).toBeNull();
    expect(arcPath(0, 0, 10, [45, 45])).toBeNull();
    expect(arcPath(0, 0, 10, [0, 400])).toBeNull();
  });
});
