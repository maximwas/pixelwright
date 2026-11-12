import { describe, expect, it } from "vitest";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

const numbers = new NumberFormat();

// D-15 (A§7.4): each class of value keeps its own places, from the one table every reader rounds with.
describe("NumberFormat.round", () => {
  it.each([
    ["a box to whole px: 10.4 gives 10 (C-010)", PRECISION.box, 10.4, 10],
    ["a gap, padding or radius to whole px", PRECISION.spacing, 7.5, 8],
    ["a border weight to 2 decimals: 2.5 stays 2.5 (C-012, B-037)", PRECISION.stroke, 2.5, 2.5],
    ["a blur to 2 decimals (C-012)", PRECISION.blur, 1.8492, 1.85],
    ["letter spacing and line heights to 2 decimals", PRECISION.textSpacing, 22.3999, 22.4],
    ["other decimals away from float noise (C-011)", PRECISION.decimal, 7.000000000000001, 7],
    ["an rgba alpha to 2 decimals", PRECISION.alpha, 0.5049, 0.5],
    ["a display-p3 channel to 4 decimals", PRECISION.p3Channel, 0.123456, 0.1235],
    ["a cubic-bezier point to 3 decimals", PRECISION.bezier, 0.41999, 0.42],
    ["an inspect angle to 2 decimals", PRECISION.angle, 89.999, 90],
  ])("rounds %s", (_name, places, value, expected) => {
    expect(numbers.round(value, places)).toBe(expected);
  });

  // toBe compares with Object.is, so -0 fails it.
  it("never gives -0 (C-011)", () => {
    expect(numbers.round(-0.4, PRECISION.box)).toBe(0);
    expect(numbers.round(-0.001, PRECISION.decimal)).toBe(0);
  });
});
