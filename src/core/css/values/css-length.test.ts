import { describe, expect, it } from "vitest";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const lengths = new CssLength(new CssVar(new CssSplit()), new NumberFormat());

describe("CssLength", () => {
  it("writes whole pixels, a bare 0 without a unit", () => {
    expect([lengths.px(12.4), lengths.px(-8), lengths.px(0.3), lengths.px(-0.2)]).toEqual(["12px", "-8px", "0", "0"]);
  });

  // C-013: the box shorthand collapses as CSS reads it.
  it("collapses a box to 1, 2 or 3 values when its sides pair", () => {
    expect(lengths.shorthand(["8px", "8px", "8px", "8px"])).toBe("8px");
    expect(lengths.shorthand(["8px", "16px", "8px", "16px"])).toBe("8px 16px");
    expect(lengths.shorthand(["8px", "16px", "4px", "16px"])).toBe("8px 16px 4px");
    expect(lengths.shorthand(["8px", "16px", "4px", "0"])).toBe("8px 16px 4px 0");
  });

  // C-016, D-22: agents write 363 out of habit; a bare line height stays a multiple.
  it("takes a bare number as px where only a length can be meant, and keeps a bare line height a multiple", () => {
    expect(lengths.pixels("363")).toBe(363);
    expect(lengths.pixels("-1.5px")).toBe(-1.5);
    expect(lengths.pixels("var(--space-8)")).toEqual({ token: "--space-8" });
    expect(lengths.pixels("1em")).toBeNull();
    expect(lengths.length("1.5")).toBeNull();
    expect(lengths.length("0")).toBe(0);
    expect(lengths.length("24px")).toBe(24);
    expect(lengths.length("var(--line, 24px)")).toEqual({ token: "--line" });
  });
});
