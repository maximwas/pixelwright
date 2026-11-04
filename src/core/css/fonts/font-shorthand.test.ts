import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const fonts = new FontShorthand(new NumberFormat(), new FontWeight());

describe("FontShorthand", () => {
  // C-112: italic and the weight from the style's name when the run gives none; a percent line height in px.
  it("writes [italic] weight size/line-height 'Family'", () => {
    expect(
      fonts.font({
        fontName: { family: "Inter", style: "Semi Bold Italic" },
        fontSize: 16,
        lineHeight: { unit: "PERCENT", value: 150 },
      }),
    ).toBe("italic 600 16px/24px 'Inter'");
    expect(
      fonts.font({
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 14,
        fontWeight: 450,
        lineHeight: { unit: "AUTO" },
      }),
    ).toBe("450 14px/normal 'Inter'");
  });

  // O-021: a family holding a quote or a backslash stays one CSS string.
  it("escapes a family holding ' or \\", () => {
    expect(
      fonts.font({
        fontName: { family: "Joe's \\ Sans", style: "Bold" },
        fontSize: 20,
        lineHeight: { unit: "PIXELS", value: 28 },
      }),
    ).toBe("700 20px/28px 'Joe\\'s \\\\ Sans'");
  });

  // C-114: em is the percent / 100, px as given, nothing at 0.
  it("writes letter spacing in em or px, and none at 0", () => {
    expect(fonts.letterSpacing({ unit: "PERCENT", value: -1 })).toBe("-0.01em");
    expect(fonts.letterSpacing({ unit: "PIXELS", value: 0.5 })).toBe("0.5px");
    expect(fonts.letterSpacing({ unit: "PERCENT", value: 0 })).toBeNull();
  });
});
