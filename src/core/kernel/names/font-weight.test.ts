import { describe, expect, it } from "vitest";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";

describe("FontWeight", () => {
  it("guesses a weight from a style name, the longer names first, regular when it names none (K-074)", () => {
    const weight = new FontWeight();

    expect(
      ["Thin", "ExtraLight", "Light", "Medium", "Semi Bold", "Bold Italic", "Extra Bold", "Black", "Italic"].map(
        (style) => weight.guess(style),
      ),
    ).toEqual([100, 200, 300, 500, 600, 700, 800, 900, 400]);
  });
});
