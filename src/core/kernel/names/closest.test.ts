import { describe, expect, it } from "vitest";
import { Closest } from "@/core/kernel/names/closest.ts";

// K-073: the "Did you mean" of an error: case ignored, within max(2, length / 3) edits.
describe("Closest", () => {
  const closest = new Closest();

  it("finds the nearest spelling whatever the case", () => {
    expect(closest.of("WIDHT", ["width", "height"])).toBe("width");
  });

  it("allows two edits in a short name and a third of the length in a long one", () => {
    expect(closest.of("abcd", ["abxy"])).toBe("abxy");
    expect(closest.of("abcd", ["axyz"])).toBeNull();
    expect(closest.of("abcdefghi", ["abcdefxyz"])).toBe("abcdefxyz");
    expect(closest.of("abcdefghi", ["abcdewxyz"])).toBeNull();
  });

  it("answers the first of two equally near names", () => {
    expect(closest.of("widht", ["right", "width"])).toBe("right");
  });

  it("answers null for no candidates", () => {
    expect(closest.of("width", [])).toBeNull();
  });
});
