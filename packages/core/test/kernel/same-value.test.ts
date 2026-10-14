import { describe, expect, it } from "vitest";
import { sameValue } from "../../src/index.ts";

describe("sameValue", () => {
  it("compares objects by their keys and values, in any key order", () => {
    expect(
      sameValue(
        {
          unit: "PIXELS",
          value: 24,
        },
        {
          value: 24,
          unit: "PIXELS",
        },
      ),
    ).toBe(true);
    expect(
      sameValue(
        {
          unit: "PIXELS",
          value: 24,
        },
        {
          unit: "PERCENT",
          value: 24,
        },
      ),
    ).toBe(false);
    expect(sameValue({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
  });

  it("compares arrays in order and by length", () => {
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false);
    expect(sameValue([], {})).toBe(false);
  });

  it("leaves out keys whose value is undefined, as JSON does", () => {
    expect(
      sameValue(
        {
          a: 1,
          b: undefined,
        },
        { a: 1 },
      ),
    ).toBe(true);
    expect(
      sameValue(
        { a: 1 },
        {
          a: 1,
          b: 2,
        },
      ),
    ).toBe(false);
  });

  it("takes 0 and -0 as the same number, and null apart from an object", () => {
    expect(sameValue(0, -0)).toBe(true);
    expect(sameValue(null, {})).toBe(false);
    expect(sameValue("1", 1)).toBe(false);
  });
});
